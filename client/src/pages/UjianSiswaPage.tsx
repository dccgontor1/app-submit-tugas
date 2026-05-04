import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UjianSiswaPage() {
  const navigate = useNavigate();
  
  // State untuk data profil (diambil dari backend via cookie)
  const [profile, setProfile] = useState<{ nama: string; examCode: string } | null>(null);
  const [status, setStatus] = useState<'waiting' | 'active' | 'done'>('waiting');
  const [timeLeft, setTimeLeft] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState('');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Fungsi Check Status (Sekaligus ambil Profile)
  const checkStatus = async () => {
    try {
      const res = await fetch('http://localhost:5000/check-status-ujian', {
        credentials: 'include', // Kirim cookie 'session' otomatis
      });

      // Jika cookie tidak valid, tendang ke login
      if (res.status === 401) {
        navigate('/');
        return;
      }

      if (!res.ok) return;
      const data = await res.json();
      
      // Simpan info nama & ujian ke state (pengganti localStorage)
      setProfile({
        nama: data.nama,
        examCode: data.examCode
      });

      // Update Logika Timer
      if (data.startedAt && data.deadline) {
        const now = new Date();
        const deadline = new Date(data.deadline);
        const diff = Math.floor((deadline.getTime() - now.getTime()) / 1000);

        if (diff <= 0) {
          setStatus('done');
          setTimeLeft(0);
        } else {
          setStatus('active');
          setTimeLeft(diff);
        }

        // Kalau ujian sudah jalan, stop polling setiap 3 detik
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (err) {
      console.error("Gagal sinkronisasi dengan server");
    }
  };

  // 2. Polling Effect
  useEffect(() => {
    checkStatus(); // Cek langsung saat masuk
    
    if (status === 'waiting') {
      pollRef.current = setInterval(checkStatus, 3000);
    }
    
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status]);

  // 3. Countdown Timer Lokal
  useEffect(() => {
    if (status !== 'active') return;
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setStatus('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status]);

  // 4. Handle Upload
  const handleUpload = async () => {
    if (!file) return setError('Pilih file dulu!');
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('http://localhost:5000/upload-jawaban', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setUploaded(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
 
  const yakin = window.confirm("Apakah Anda yakin ingin logout? Sesi ujian akan tetap berjalan di server.");
  if (!yakin) return;

  try {
    await fetch('http://localhost:5000/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    navigate('/', { replace: true });
  } catch (err) {
    console.error("Gagal logout");
    
    navigate('/');
  }
};

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerColor = timeLeft < 300 ? 'text-red-300' : timeLeft < 600 ? 'text-amber-300' : 'text-emerald-300';

  // Loading Screen jika profil belum dimuat
  if (!profile) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 animate-spin rounded-full" />
    </div>
  );

  // ── WAITING ROOM ──────────────────────────────────────────
  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative z-10 text-center max-w-md">
          <div className="w-12 h-12 border border-white/10 rounded-sm flex items-center justify-center mx-auto mb-8">
            <span className="font-mono text-lg text-white/20">⏳</span>
          </div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-white/20 uppercase mb-3">Waiting Room</p>
          <h1 className="font-mono text-2xl font-bold text-white mb-2">{profile.examCode}</h1>
          <p className="text-sm text-white/30 mb-8">
            Halo, <span className="text-white/60">{profile.nama}</span>.<br />
            Ujian belum dimulai. Tunggu instruksi dari guru.
          </p>
          <button 
            onClick={handleLogout}
            className="font-mono text-[20px] text-white mb-10 hover:text-white/50 transition-colors uppercase tracking-[0.2em]"
          >
            Keluar dari Sesi
          </button>
          <div className="flex gap-2 justify-center">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
            
          </div>
          
        </div>
      </div>
    );
  }


  // ── SELESAI / UPLOADED ────────────────────────────────────
  if (status === 'done' || uploaded) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="font-mono text-[10px] tracking-[0.25em] text-white/20 uppercase mb-3">
            {uploaded ? 'Selesai' : 'Waktu Habis'}
          </p>
          <h1 className="font-mono text-2xl font-bold text-white mb-4">
            {uploaded ? 'Jawaban Terkirim' : 'Ujian Berakhir'}
          </h1>
          <p className="text-sm text-white/30">
            {uploaded
              ? 'File jawabanmu berhasil dikumpulkan. Kamu bisa menutup halaman ini.'
              : 'Waktu ujian sudah habis. Hubungi guru jika perlu perpanjangan.'}
          </p>
        </div>
      </div>
    );
  }

  // ── UJIAN AKTIF ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header timer */}
      <div className="bg-[#0d0d14] border-b border-white/6 px-8 py-4 flex items-center justify-between">
        <div className="text-right flex flex-col items-end gap-2">
          <div>
            <p className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">
              {profile.nama}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="font-mono text-[9px] text-red-400/50 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            [ Log_Out ]
          </button>
        </div>
        <div className="text-center">
          <p className="font-mono text-[9px] tracking-[0.15em] text-white/25 uppercase mb-1">Sisa Waktu</p>
          <p className={`font-mono text-3xl font-bold tabular-nums ${timerColor}`}>
            {formatCountdown(timeLeft)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">{profile.nama}</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-mono text-xl font-bold text-white mb-2">Kumpulkan Jawaban</h1>
        <p className="text-sm text-white/30 mb-8">
          Upload file jawabanmu sebelum waktu habis. Pastikan format file sesuai instruksi guru.
        </p>

        {/* Upload area */}
        <div
          className={`border-2 border-dashed rounded-sm p-12 text-center transition-colors cursor-pointer ${
            file ? 'border-emerald-500/40 bg-emerald-500/3' : 'border-white/10 hover:border-white/20'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <>
              <p className="font-mono text-sm text-emerald-300 mb-1">{file.name}</p>
              <p className="font-mono text-[10px] text-white/25">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] tracking-[0.15em] text-white/20 uppercase mb-2">Klik untuk pilih file</p>
              <p className="text-[11px] text-white/15">PDF, DOCX, JPG, PNG</p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full mt-6 bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs tracking-widest uppercase rounded-sm py-4 transition-colors active:scale-[0.99]"
        >
          {uploading ? 'Mengunggah...' : 'Kumpulkan Jawaban →'}
        </button>

        <p className="text-center text-[11px] text-white/15 mt-4 font-mono">
          Kamu bisa upload ulang sebelum waktu habis — file lama akan diganti.
        </p>
      </main>
    </div>
  );
}