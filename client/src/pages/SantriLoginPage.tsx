import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSesi = async () => {
      try {
        const res = await fetch('http://localhost:5000/sesi-status', { credentials: 'include' });
        const data = await res.json();
        
        // Jika status OK dan ada instruksi redirect dari backend
        if (res.ok && data.redirectTo) {
          navigate(data.redirectTo, { replace: true });
        }
      } catch (e) {
        // Biarkan di halaman login jika tidak ada sesi
      }
    };
    checkSesi();
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  

  try {
    const res = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Penting agar cookie dari server disimpan browser
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    // 1. Cek jika respon tidak OK (401, 403, 500, dll)
    if (!res.ok) {
      if (res.status === 500) {
        navigate('/500');
        return;
      }
      // Lempar error agar ditangkap oleh blok catch
      throw new Error(data.message || 'Terjadi kesalahan login.');
    }

    if (data.success) {
      
      navigate('/ujian', { replace: true });
    }

  } catch (err: any) {
    // Tangani semua error di sini
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  // Auto-format: pisah tiap 4 karakter dengan dash, contoh: ABCD-1234-EFGH
    const handleCodeChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(clean);
    };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#0a0a0f] relative overflow-hidden">
      {/* Grid bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
          top: -100, right: -100,
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Card */}
        <div className="bg-[#13131a] border border-white/8 rounded-sm p-10">
          <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-400 uppercase mb-2">
            Portal Ujian
          </p>
          <h1 className="font-mono text-3xl font-bold text-white leading-tight mb-1">
            DCC<br />EXAM
          </h1>
          <p className="text-sm text-white/35 mb-10">
            Masukkan kode ujian yang diberikan oleh gurumu.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-3 text-sm text-red-300 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-3">
                Kode Akses Ujian
              </label>
              {/* Input besar untuk kode */}
              <input
                type="text"
                required
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                placeholder="XXXXXX"
                maxLength={6}
                spellCheck={false}
                className="w-full bg-white/4 border border-white/10 rounded-sm px-4 py-4 font-mono text-2xl text-center tracking-[0.5em] text-white placeholder-white/15 outline-none focus:border-emerald-500/50 focus:bg-emerald-500/3 transition-colors"
                />
                <p className="text-[11px] text-white/20 text-center mt-2">
                6 karakter — huruf dan angka.
                </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs tracking-widest uppercase rounded-sm py-3.5 transition-colors active:scale-[0.99]"
            >
              {loading ? 'Memverifikasi...' : 'Mulai Ujian →'}
            </button>
          </form>
        </div>

        {/* Link ke login admin */}
        <p className="text-center mt-6 text-[11px] text-white/15 font-mono">
          Admin?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-white/30 hover:text-white/60 underline underline-offset-2 transition-colors"
          >
            Masuk ke panel
          </button>
        </p>
      </div>
    </div>
  );
}