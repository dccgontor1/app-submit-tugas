import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';
import { BookOpen, User, ArrowRight, Loader2 } from 'lucide-react';

interface Ujian {
  id: string;
  judul: string;
}

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [stambuk, setStambuk] = useState('');
  const [ujianId, setUjianId] = useState('');
  const [availableExams, setAvailableExams] = useState<Ujian[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/available-exams`);
        if (res.ok) {
          const data = await res.json();
          setAvailableExams(data);
        }
      } catch (e) {
        console.error("Gagal ambil daftar ujian");
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();

    const checkSesi = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sesi-status`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.redirectTo) {
          navigate(data.redirectTo, { replace: true });
        }
      } catch (e) {
        // Silently fail
      }
    };
    checkSesi();
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stambuk.trim()) return setError('Masukkan Stambuk Anda!');
    if (!ujianId) return setError('Silakan pilih ujian!');

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stambuk: stambuk.trim(), ujianId }),
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

  return (
    <div className="min-h-screen bg-[#03050a] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-float pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 w-full max-w-md animate-modalIn">
        <div className="glass-panel p-10 rounded-3xl relative overflow-hidden group border border-white/5 shadow-2xl">
          {/* Subtle Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.01] to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

          <div className="text-center mb-10 relative">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(59,130,246,0.2)]">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <p className="text-[10px] tracking-[0.3em] text-cyan-400 uppercase mb-3 font-bold">
              Student Access Portal
            </p>
            <h1 className="text-3xl font-extrabold text-white mb-3 text-glow tracking-tight">
              DCC Submit Center
            </h1>
            <p className="text-sm text-white/40 max-w-[280px] mx-auto leading-relaxed">
              Silakan pilih ujian dan masukkan stambuk Anda untuk masuk ke ruang ujian.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3.5 text-xs text-red-300 mb-8 backdrop-blur-md flex items-center gap-3 animate-shake">
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <span className="font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 relative">
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold ml-1">
                Pilih Ujian
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-cyan-400 transition-colors">
                  <BookOpen className="w-5 h-5" />
                </div>
                <select
                  required
                  value={ujianId}
                  onChange={e => setUjianId(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:border-cyan-500/50 focus:bg-cyan-500/5 transition-all appearance-none cursor-pointer"
                  disabled={loadingExams}
                >
                  <option value="" className="bg-[#03050a] text-white/50">
                    {loadingExams ? 'Memuat daftar ujian...' : '— Pilih Ujian —'}
                  </option>
                  {availableExams.map(u => (
                    <option key={u.id} value={u.id} className="bg-[#03050a] text-white">
                      {u.judul}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold ml-1">
                Nomor Stambuk
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-cyan-400 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={stambuk}
                  onChange={e => setStambuk(e.target.value)}
                  placeholder="Contoh: 81972"
                  spellCheck={false}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-white/10 outline-none focus:border-cyan-500/50 focus:bg-cyan-500/5 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || loadingExams}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-white/5 disabled:to-white/5 disabled:text-white/20 disabled:border-white/5 border border-white/10 text-white font-bold text-sm tracking-[0.2em] uppercase rounded-2xl py-4.5 transition-all duration-300 active:scale-[0.98] shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] disabled:shadow-none mt-4 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Mulai Ujian</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-10 space-y-4 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => navigate('/login')}
              className="text-xs text-white/30 hover:text-cyan-400 transition-colors font-medium flex items-center gap-2"
            >
              <div className="w-1 h-1 rounded-full bg-white/20" />
              Guru / Admin
            </button>
            <button
              onClick={() => navigate('/typing')}
              className="text-xs text-white/30 hover:text-emerald-400 transition-colors font-medium flex items-center gap-2"
            >
              <div className="w-1 h-1 rounded-full bg-white/20" />
              Latihan Mengetik
            </button>
          </div>
          <p className="text-[10px] text-white/10 tracking-widest uppercase font-bold">
            &copy; 2026 DCC Information System
          </p>
        </div>
      </div>
    </div>
  );
}
