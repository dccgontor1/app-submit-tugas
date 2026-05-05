import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSesi = async () => {
      try {
        const res = await fetch('http://localhost:5000/sesi-status', { credentials: 'include' });
        const data = await res.json();
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
      const res = await fetch('http://localhost:5000/login-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login gagal!');

      login({ nama: data.user.nama, role: data.user.role });
      navigate(data.redirectTo || '/dashboard', { replace: true });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* Liquid / Orb Backgrounds for Admin */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] animate-float" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 w-full max-w-md animate-modalIn">
        {/* Glass Card */}
        <div className="glass-panel p-10 rounded-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.02] to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          
          <div className="text-center mb-10 relative">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
            </div>
            <p className="text-xs tracking-[0.25em] text-indigo-400 uppercase mb-2 font-semibold">
              Admin Portal
            </p>
            <h1 className="text-3xl font-bold text-white mb-2 text-glow tracking-tight">
              DCC Submit Center
            </h1>
            <p className="text-sm text-white/50">
              Masuk ke Dashboard Guru / Admin
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

          <form onSubmit={handleSubmit} className="space-y-5 relative">
            <div>
              <label className="block text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2 font-medium">
                Username
              </label>
              <input
                type="text"
                required
                placeholder="admin_dcc"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2 font-medium">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 disabled:from-white/10 disabled:to-white/5 disabled:text-white/30 disabled:border-white/5 border border-white/10 text-white font-bold text-sm tracking-widest uppercase rounded-xl py-4 mt-2 transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] disabled:shadow-none"
            >
              {loading ? 'Autentikasi...' : 'Masuk Sistem'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}