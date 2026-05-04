import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate()
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
    const res = await fetch('http://localhost:5000/login-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // ✅ kirim/terima cookie
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login gagal!');

    login({ nama: data.user.nama, role: data.user.role }); // ✅ simpan info user saja

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          top: -100, left: -100,
        }}
      />

      <div className="relative z-10 w-full max-w-md bg-[#13131a] border border-white/8ded-sm p-10">
        <p className="font-mono text-[10px] tracking-[0.2em] text-indigo-400 uppercase mb-2">
          Panel Administrasi
        </p>
        <h1 className="font-mono text-3xl font-bold text-white leading-tight mb-1">
          DCC<br />EXAM
        </h1>
        <p className="text-sm text-white/35 mb-10">
          Masuk untuk mengelola akun dan ujian.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-sm px-4 py-3 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">
              Username
            </label>
            <input
              type="text"
              required
              placeholder="admin_dcc"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-white/4 border border-white/10 rounded-sm px-4 py-3 text-sm text-[#e8e6e0] placeholder-white/20 outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 transition-colors"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/4 border border-white/10 rounded-sm px-4 py-3 text-sm text-[#e8e6e0] placeholder-white/20 outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono text-xs tracking-widest uppercase rounded-sm py-3.5 mt-2 transition-colors active:scale-[0.99]"
          >
            {loading ? 'Autentikasi...' : 'Masuk →'}
          </button>
        </form>
      </div>
    </div>
  );
}