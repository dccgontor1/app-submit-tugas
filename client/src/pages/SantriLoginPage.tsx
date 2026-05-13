import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSesi = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sesi-status`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.redirectTo) {
          navigate(data.redirectTo, { replace: true });
        }
      } catch (e) {

      }
    };
    checkSesi();
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 500) {
          navigate('/500');
          return;
        }
        throw new Error(data.message || 'Terjadi kesalahan login.');
      }

      if (data.success) {
        navigate('/ujian', { replace: true });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(clean);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] animate-float" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 w-full max-w-md animate-modalIn">
        {}
        <div className="glass-panel p-10 rounded-2xl relative overflow-hidden group">
          {}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.02] to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

          <div className="text-center mb-10 relative">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-xs tracking-[0.25em] text-cyan-400 uppercase mb-2 font-semibold">
              Student Portal
            </p>
            <h1 className="text-3xl font-bold text-white mb-2 text-glow tracking-tight">
              DCC Submit Center
            </h1>
            <p className="text-sm text-white/50">
              Masukkan 6 digit kode token dari admin
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 mb-6 backdrop-blur-md flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 relative">
            <div>
              <input
                type="text"
                required
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                placeholder="XXXXXX"
                maxLength={6}
                spellCheck={false}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 font-mono text-3xl text-center tracking-[0.4em] text-white placeholder-white/10 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:border-white/5 border border-white/10 text-white font-bold text-sm tracking-widest uppercase rounded-xl py-4 transition-all duration-300 active:scale-[0.98] shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] disabled:shadow-none"
            >
              {loading ? 'Memverifikasi...' : 'Mulai Ujian'}
            </button>
          </form>
        </div>

        {}
        <p className="text-center mt-8 text-xs text-white/30 tracking-wide flex flex-col gap-2">
          <span>
            Guru / Admin?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-cyan-400 hover:text-cyan-300 hover:underline underline-offset-4 transition-colors font-medium"
            >
              Masuk ke Dashboard
            </button>
          </span>
          <span>
            Ingin latihan?{' '}
            <button
              onClick={() => navigate('/typing')}
              className="text-emerald-400 hover:text-emerald-300 hover:underline underline-offset-4 transition-colors font-medium"
            >
              Latihan Mengetik (Mafatype)
            </button>
          </span>
        </p>
      </div>
    </div>
  );
}