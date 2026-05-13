import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Keyboard, Info } from 'lucide-react';

export default function MafatypePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050a] flex flex-col">
      {/* Background elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-float pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Navigation Header */}
      <nav className="relative z-40 h-16 flex items-center justify-between px-8 border-b border-white/[0.05] glass-panel">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <Keyboard className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">Mafatype</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold">Typing Speed Master</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <Info className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-white/60">Gunakan komputer untuk pengalaman terbaik</span>
          </div>
        </div>
      </nav>

      {/* Main Content Area (Iframe) */}
      <main className="flex-1 relative z-10 flex items-center justify-center p-4 md:p-8">
        <div className="w-full h-full glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative bg-black/20">

          <iframe
            src="/mafatype/frontend/index.html"
            className="w-full h-full border-none"
            title="Mafatype Typing Test"
            allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </main>

      {/* Footer / Status bar */}
      <footer className="relative z-10 px-8 py-4 flex justify-between items-center bg-black/40 border-t border-white/[0.05]">
        <p className="text-[10px] text-white/30 uppercase tracking-widest">DCC Project &copy; 2026</p>
        <div className="flex gap-4">
          <span className="text-[10px] text-emerald-400/70 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ready for Practice
          </span>
        </div>
      </footer>
    </div>
  );
}
