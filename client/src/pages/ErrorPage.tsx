import { useNavigate } from 'react-router-dom';

interface ErrorPageProps {
  code: 404 | 500 | 401 | 403;
}

const config = {
  404: {
    title: 'Tidak Ditemukan',
    desc: 'Halaman yang kamu cari tidak ada atau sudah dipindahkan.',
    action: 'Kembali ke Dashboard',
    to: '/dashboard',
  },
  401: {
    title: 'Tidak Terautentikasi',
    desc: 'Sesi kamu telah berakhir atau kamu belum login.',
    action: 'Ke Halaman Login',
    to: '/login',
  },
  403: {
    title: 'Akses Ditolak',
    desc: 'Kamu tidak memiliki izin untuk mengakses halaman ini.',
    action: 'Kembali',
    to: '/login',
  },
  500: {
    title: 'Kesalahan Server',
    desc: 'Terjadi kesalahan pada server. Coba beberapa saat lagi.',
    action: 'Kembali',
    to: 'login',
  },
};

export default function ErrorPage({ code }: ErrorPageProps) {
  const navigate = useNavigate();
  const { title, desc, action, to } = config[code];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Grid bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 text-center max-w-md">
        {/* Code */}
        <div
          className="font-mono font-bold text-white leading-none mb-6 select-none"
          style={{ fontSize: 'clamp(80px, 20vw, 140px)', opacity: 0.06 }}
        >
          {code}
        </div>

        {/* Content — overlaps the big number */}
        <div style={{ marginTop: '-2rem' }}>
          <div className="font-mono text-[10px] tracking-[0.25em] text-indigo-400 uppercase mb-3">
            Error {code}
          </div>
          <h1 className="font-mono text-2xl font-bold text-white mb-4">
            {title}
          </h1>
          <p className="text-sm text-white/35 leading-relaxed mb-8">
            {desc}
          </p>
          <button
            onClick={() => navigate(to)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[11px] tracking-[0.1em] uppercase px-6 py-3 rounded-sm transition-colors active:scale-[0.98]"
          >
            {action} →
          </button>
        </div>
      </div>
    </div>
  );
}