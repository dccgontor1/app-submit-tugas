import { Timer } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';

export default function UjianSiswaPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<{ nama: string; examCode: string } | null>(null);
  const [status, setStatus] = useState<'waiting' | 'active' | 'done'>('waiting');
  const [timeLeft, setTimeLeft] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sesi-status`, { credentials: 'include' });
        if (res.status === 401) { navigate('/'); return; }
        if (!res.ok) return;
        const data = await res.json();
        if (!data.isStaff) {
          setProfile({ nama: data.nama, examCode: data.examCode ?? 'Ujian' });
        }
      } catch {

      }
    };
    fetchProfile();
  }, [navigate]);

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/check-status-ujian`, { credentials: 'include' });

      if (res.status === 401) { navigate('/'); return; }
      if (res.status === 404) { setUploaded(true); return; }
      if (!res.ok) return;

      const data = await res.json();

      if (data.submitted) {
        setUploaded(true);
        return;
      }

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

        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch (err) {
      console.error("Gagal sinkronisasi");
    }
  };

  useEffect(() => {
    checkStatus();
    if (status === 'waiting') {
      pollRef.current = setInterval(checkStatus, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status]);

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

  const handleUpload = async () => {
    if (!file) return setError('Pilih file dulu!');
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/upload-jawaban`, {
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
      await fetch(`${API_BASE_URL}/logout`, { method: 'POST', credentials: 'include' });
      navigate('/', { replace: true });
    } catch (err) {
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

  const timerColor = timeLeft < 300 ? 'text-red-400 text-glow-red' : timeLeft < 600 ? 'text-amber-400 text-glow-amber' : 'text-cyan-400 text-glow';

  const LiquidBackground = () => (
    <>
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-float pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: '2s' }} />
    </>
  );

  if (!profile) return (
    <div className="min-h-screen bg-[#03050a] flex items-center justify-center relative overflow-hidden">
      <LiquidBackground />
      <div className="w-10 h-10 border-2 border-white/10 border-t-cyan-400 animate-spin rounded-full relative z-10" />
    </div>
  );

  if (status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
        <LiquidBackground />
        <div className="glass-panel p-10 rounded-3xl relative z-10 text-center max-w-md w-full animate-modalIn shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]">
            <Timer className="w-8 h-8 animate-pulse text-cyan-400" />
          </div>
          <p className="text-[10px] tracking-[0.25em] text-cyan-400 font-semibold uppercase mb-3">Waiting Room</p>
          <h1 className="text-3xl font-bold text-white mb-2 text-glow">{profile.examCode}</h1>
          <p className="text-sm text-white/50 mb-8 leading-relaxed">
            Halo, <span className="text-white/80 font-medium">{profile.nama}</span>.<br />
            Ujian belum dimulai. Tunggu instruksi dari guru.
          </p>
          <button
            onClick={handleLogout}
            className="text-xs text-white/40 hover:text-white/80 transition-colors uppercase tracking-[0.15em] mb-8 font-medium"
          >
            Keluar dari Sesi
          </button>
          <div className="flex gap-2.5 justify-center">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-cyan-400/50 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'done' || uploaded) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
        <LiquidBackground />
        <div className="glass-panel p-12 rounded-3xl relative z-10 text-center max-w-md w-full animate-modalIn">
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-8 ${uploaded ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {uploaded
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              }
            </svg>
          </div>
          <p className="text-[10px] tracking-[0.25em] text-white/40 uppercase mb-3 font-medium">
            {uploaded ? 'Berhasil' : 'Waktu Habis'}
          </p>
          <h1 className="text-2xl font-bold text-white mb-4">
            {uploaded ? 'Jawaban Terkirim' : 'Ujian Berakhir'}
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            {uploaded
              ? 'File jawabanmu berhasil dikumpulkan ke server. Kamu bisa menutup halaman ini.'
              : 'Waktu ujian sudah habis. Hubungi guru jika perlu perpanjangan.'}
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium py-3.5 rounded-xl transition-all"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <LiquidBackground />

      {}
      <div className="fixed top-0 inset-x-0 z-40 p-4">
        <div className="glass-panel max-w-4xl mx-auto rounded-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] tracking-[0.15em] text-white/40 uppercase font-medium">Peserta</span>
            <span className="text-sm font-semibold text-white/90">{profile.nama}</span>
          </div>

          <div className="text-center absolute left-1/2 -translate-x-1/2">
            <p className="text-[9px] tracking-[0.2em] text-white/40 uppercase mb-1 font-medium">Sisa Waktu</p>
            <p className={`font-mono text-3xl font-bold tabular-nums tracking-tight ${timerColor}`}>
              {formatCountdown(timeLeft)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] tracking-[0.15em] text-white/40 uppercase font-medium">Sesi</span>
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-2xl mx-auto px-6 pt-40 pb-20">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3 text-glow">Kumpulkan Jawaban</h1>
          <p className="text-sm text-white/50">
            Upload file jawabanmu sebelum waktu habis. Pastikan format file sesuai instruksi.
          </p>
        </div>

        {}
        <div className="glass-panel p-8 rounded-3xl transition-all hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] group">
          <div
            className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer ${
              file ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/10 group-hover:border-blue-500/30 group-hover:bg-blue-500/5'
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
              <div className="animate-modalIn">
                <div className="w-16 h-16 mx-auto bg-cyan-500/20 rounded-2xl flex items-center justify-center mb-4 text-cyan-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-cyan-300 mb-1">{file.name}</p>
                <p className="text-xs text-white/40">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <div className="w-16 h-16 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-white/30 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-white/60 mb-2">Pilih File Jawaban</p>
                <p className="text-xs text-white/30">Klik untuk menjelajah file dari perangkatmu</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full mt-8 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:border-white/5 border border-white/10 text-white font-bold text-sm tracking-widest uppercase rounded-xl py-4 transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] disabled:shadow-none"
          >
            {uploading ? 'Mengunggah...' : 'Kumpulkan Sekarang'}
          </button>
        </div>
      </main>
    </div>
  );
}