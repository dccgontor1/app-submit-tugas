import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Tugas, Ujian, RiwayatUjian } from '../types';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FileText,
  Check
} from 'lucide-react';

const Icon = {
  close: <X className="w-4 h-4" />,
  download: <Download className="w-3.5 h-3.5" />,
  chevronLeft: <ChevronLeft className="w-4 h-4" />,
  chevronRight: <ChevronRight className="w-4 h-4" />,
  chevronDown: <ChevronDown className="w-3.5 h-3.5" />,
  refresh: <RefreshCw className="w-3.5 h-3.5" />,
  file: <FileText className="w-8 h-8" />,
  check: <Check className="w-3.5 h-3.5" />,
};

const cleanPath = (raw: string) =>
  raw.replace(/^.*[/\\]uploads[/\\]/, '').replace(/\\/g, '/');

const fileUrl = (raw: string) =>
  `http://localhost:5000/uploads/${cleanPath(raw)}`;

const fileExt = (raw: string) =>
  cleanPath(raw).split('.').pop()?.toLowerCase() ?? '';

const initials = (nama: string) =>
  nama.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const nilaiColor = (n: number) =>
  n >= 75 ? 'text-emerald-400' : n >= 60 ? 'text-amber-400' : 'text-red-400';

const formatTanggal = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
};

const StatusBadge = ({ status }: { status: Tugas['status'] }) => {
  const cfg = {
    MENUNGGU:     { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/25',   label: 'Menunggu' },
    DINILAI:      { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', label: 'Dinilai' },
    DIKEMBALIKAN: { cls: 'bg-red-500/10 text-red-400 border-red-500/20',         label: 'Dikembalikan' },
  };
  const { cls, label } = cfg[status];
  return (
    <span className={`inline-block font-mono text-[9px] tracking-[0.12em] uppercase px-2.5 py-[3px] border rounded-[2px] ${cls}`}>
      {label}
    </span>
  );
};

const FilePreview = ({ filePath }: { filePath: string }) => {
  const url  = fileUrl(filePath);
  const ext  = fileExt(filePath);
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isPdf   = ext === 'pdf';

  if (isImage) {
    return (
      <img
        src={url}
        alt="File tugas"
        className="max-w-full object-contain rounded-sm"
        style={{ maxHeight: 'calc(100vh - 56px - 1px)' }}
      />
    );
  }
  if (isPdf) {
    return (
      <iframe
        src={url}
        title="File tugas"
        className="w-full border-0 rounded-sm"
        style={{ height: 'calc(100vh - 56px - 1px)' }}
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="w-20 h-20 rounded-sm bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-white/15">
        {Icon.file}
      </div>
      <div className="text-center">
        <p className="font-mono text-[11px] tracking-[0.15em] text-white/20 uppercase mb-1">.{ext}</p>
        <p className="text-sm text-white/20">Preview tidak tersedia</p>
        <p className="text-xs text-white/12 mt-1">Gunakan tombol Download di atas</p>
      </div>
    </div>
  );
};

export default function PenilaianPage() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  const [activePageTab, setActivePageTab] = useState<'penilaian' | 'riwayat'>('penilaian');
  const [ujianList,    setUjianList]    = useState<Ujian[]>([]);
  const [selectedUjian, setSelectedUjian] = useState<string>('');
  const [tugasList,    setTugasList]    = useState<Tugas[]>([]);
  const [isLoadingUjian, setIsLoadingUjian] = useState(false);
  const [isLoadingTugas, setIsLoadingTugas] = useState(false);

  const [viewerOpen,  setViewerOpen]   = useState(false);
  const [viewerIndex, setViewerIndex]  = useState(0);

  const [inputNilai,   setInputNilai]   = useState('');
  const [inputCatatan, setInputCatatan] = useState('');
  const [isSaving,     setIsSaving]     = useState(false);
  const [savedId,      setSavedId]      = useState<number | null>(null);

  const [filterStatus, setFilterStatus] = useState<'SEMUA' | 'MENUNGGU' | 'DINILAI' | 'DIKEMBALIKAN'>('SEMUA');

  const [riwayatList,       setRiwayatList]       = useState<RiwayatUjian[]>([]);
  const [isLoadingRiwayat,  setIsLoadingRiwayat]  = useState(false);
  const [riwayatUjianId,    setRiwayatUjianId]    = useState('');
  const [hasilGuru,         setHasilGuru]         = useState<Tugas[]>([]);
  const [isLoadingHasil,    setIsLoadingHasil]    = useState(false);
  const [printTarget,       setPrintTarget]       = useState<Tugas | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchUjian = async () => {
    setIsLoadingUjian(true);
    try {
      const res = await fetch('http://localhost:5000/admin/ujian', { credentials: 'include' });
      if (res.status === 401) return navigate('/401');
      if (res.status === 403) return navigate('/403');
      const data = await res.json();
      setUjianList(data);
      if (data.length > 0) setSelectedUjian(data[0].id);
    } catch { setUjianList([]); }
    finally   { setIsLoadingUjian(false); }
  };

  const fetchTugas = async (ujianId: string) => {
    if (!ujianId) return;
    setIsLoadingTugas(true);
    try {
      const res = await fetch(`http://localhost:5000/admin/tugas?ujianId=${ujianId}`, {
        credentials: 'include',
      });
      if (res.status === 401) return navigate('/401');
      if (res.status === 403) return navigate('/403');
      if (!res.ok) throw new Error();
      setTugasList(await res.json());
    } catch { setTugasList([]); }
    finally   { setIsLoadingTugas(false); }
  };

  const fetchRiwayat = async () => {
    setIsLoadingRiwayat(true);
    try {
      const res = await fetch('http://localhost:5000/admin/ujian/riwayat', { credentials: 'include' });
      if (res.ok) setRiwayatList(await res.json());
    } catch {} finally { setIsLoadingRiwayat(false); }
  };

  const fetchHasilGuru = async (id: string) => {
    if (!id) return;
    setIsLoadingHasil(true);
    try {
      const res = await fetch(`http://localhost:5000/admin/ujian/${id}/hasil`, { credentials: 'include' });
      if (res.ok) setHasilGuru(await res.json());
      else setHasilGuru([]);
    } catch { setHasilGuru([]); } finally { setIsLoadingHasil(false); }
  };

  const handlePrintSiswa = (t: Tugas) => {
    setPrintTarget(t);
    setTimeout(() => window.print(), 100);
  };

  useEffect(() => { fetchUjian(); fetchRiwayat(); }, []);
  useEffect(() => { if (selectedUjian) fetchTugas(selectedUjian); }, [selectedUjian]);
  useEffect(() => { if (riwayatUjianId) fetchHasilGuru(riwayatUjianId); }, [riwayatUjianId]);

  const filtered = filterStatus === 'SEMUA'
    ? tugasList
    : tugasList.filter(t => t.status === filterStatus);

  const currentTugas = filtered[viewerIndex] ?? null;

  const stats = {
    total:    tugasList.length,
    menunggu: tugasList.filter(t => t.status === 'MENUNGGU').length,
    dinilai:  tugasList.filter(t => t.status === 'DINILAI').length,
    rataRata: tugasList.filter(t => t.nilai !== null).length > 0
      ? (tugasList.filter(t => t.nilai !== null).reduce((a, b) => a + (b.nilai ?? 0), 0) /
         tugasList.filter(t => t.nilai !== null).length).toFixed(1)
      : '—',
  };

  const openViewer = (idx: number) => {
    setViewerIndex(idx);
    const t = filtered[idx];
    setInputNilai(t?.nilai?.toString() ?? '');
    setInputCatatan(t?.catatan ?? '');
    setViewerOpen(true);
  };

  const goTo = useCallback((dir: 1 | -1) => {
    const next = viewerIndex + dir;
    if (next < 0 || next >= filtered.length) return;
    setViewerIndex(next);
    const t = filtered[next];
    setInputNilai(t?.nilai?.toString() ?? '');
    setInputCatatan(t?.catatan ?? '');
  }, [viewerIndex, filtered]);

  useEffect(() => {
    if (!viewerOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
      if (e.key === 'Escape')     setViewerOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [viewerOpen, goTo]);

  const handleSimpan = async () => {
    if (!currentTugas) return;
    const nilai = Number(inputNilai);
    if (isNaN(nilai) || nilai < 0 || nilai > 100) return alert('Nilai harus antara 0–100');
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:5000/admin/tugas/${currentTugas.id}/nilai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nilai, catatan: inputCatatan }),
      });
      if (!res.ok) throw new Error();
      setTugasList(prev =>
        prev.map(t =>
          t.id === currentTugas.id
            ? { ...t, nilai, catatan: inputCatatan, status: 'DINILAI', dinilaiAt: new Date().toISOString() }
            : t
        )
      );
      setSavedId(currentTugas.id);
      setTimeout(() => setSavedId(null), 1800);
      if (viewerIndex < filtered.length - 1) setTimeout(() => goTo(1), 700);
    } catch { alert('Gagal menyimpan nilai'); }
    finally   { setIsSaving(false); }
  };

  const LiquidBackground = () => (
    <>
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] animate-float pointer-events-none" style={{ animationDelay: '1s' }} />
      <div className="fixed bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: '3s' }} />
    </>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050a]">
      <LiquidBackground />

      {}
      <nav className="glass-panel sticky top-0 z-40 h-16 flex items-center justify-between px-8 border-b border-white/[0.05]">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg text-white tracking-wide flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            DCC<span className="text-indigo-400 font-light">Admin</span>
          </span>
          <div className="flex items-center gap-2">
            {[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Ujian', path: '/ujian-admin' }, { label: 'Penilaian', path: '/penilaian' }].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`text-xs font-medium tracking-wide px-4 py-2 rounded-xl transition-all ${path === '/penilaian' ? 'text-white bg-white/10 shadow-sm' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }}
          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all font-medium border border-red-500/20">Keluar</button>
      </nav>

      <main className="max-w-6xl mx-auto px-8 py-12 relative z-10">
        {}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[10px] tracking-[0.3em] text-indigo-400/70 uppercase font-bold mb-2">Evaluasi Hasil</p>
            <h1 className="text-4xl font-bold text-white text-glow">Penilaian Tugas</h1>
          </div>
          <div className="flex items-center gap-3">
            {['penilaian', 'riwayat'].map(tab => (
              <button key={tab} onClick={() => setActivePageTab(tab as any)}
                className={`text-xs font-bold tracking-widest uppercase px-5 py-2.5 rounded-xl border transition-all ${
                  activePageTab === tab ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30' : 'text-white/30 border-white/10 hover:text-white/60 hover:bg-white/5'
                }`}>{tab}</button>
            ))}
          </div>
        </div>

        {activePageTab === 'penilaian' && (<>
        {}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 glass-panel p-6 rounded-3xl border border-white/5 bg-white/[0.02]">
            <label className="block text-[10px] tracking-wider text-white/30 uppercase mb-4 font-bold">Pilih Ujian</label>
            {isLoadingUjian ? (
              <div className="h-12 bg-white/5 rounded-2xl animate-pulse" />
            ) : (
              <div className="relative group">
                <select value={selectedUjian} onChange={e => setSelectedUjian(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-5 pr-12 py-3.5 text-sm text-white outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer">
                  {ujianList.map(u => (
                    <option key={u.id} value={u.id} className="bg-[#0f0f1a]">{u.judul}</option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white/40 transition-colors pointer-events-none">
                  {Icon.chevronDown}
                </span>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 glass-panel p-1 rounded-3xl border border-white/5 bg-white/[0.02] flex items-stretch">
            {[
              { label: 'Total', value: stats.total, color: 'text-white' },
              { label: 'Menunggu', value: stats.menunggu, color: 'text-amber-400' },
              { label: 'Dinilai', value: stats.dinilai, color: 'text-emerald-400' },
              { label: 'Rata-rata', value: stats.rataRata, color: 'text-indigo-400' },
            ].map(({ label, value, color }, i) => (
              <div key={label} className={`flex-1 px-6 py-5 flex flex-col justify-center ${i !== 3 ? 'border-r border-white/5' : ''}`}>
                <p className="text-[9px] tracking-widest text-white/20 uppercase mb-1 font-bold">{label}</p>
                <p className={`text-2xl font-bold ${color} text-glow`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {(['SEMUA', 'MENUNGGU', 'DINILAI', 'DIKEMBALIKAN'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-all border ${
                filterStatus === s ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 shadow-lg' : 'text-white/30 border-transparent hover:text-white/60 hover:bg-white/5'
              }`}>
              {s.toLowerCase()}
            </button>
          ))}
        </div>

        {}
        <div className="glass-panel rounded-[2rem] overflow-hidden border border-white/10 bg-black/10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                {['No', 'Siswa', 'Deadline', 'Status', 'Nilai', ''].map((h, i) => (
                  <th key={i} className={`px-8 py-5 text-[10px] tracking-[0.2em] text-white/25 uppercase font-bold ${i === 4 ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingTugas ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-white/5 rounded-lg animate-pulse w-full" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center">
                    <div className="text-white/10 text-xs font-bold uppercase tracking-[0.3em]">Tidak ada tugas ditemukan</div>
                  </td>
                </tr>
              ) : filtered.map((tugas, idx) => (
                <tr key={tugas.id} onClick={() => openViewer(idx)}
                  className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.04] cursor-pointer transition-all group">
                  <td className="px-8 py-5 text-xs text-white/20 font-mono">{idx + 1}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 group-hover:scale-110 transition-transform">
                        {initials(tugas.nama)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{tugas.nama}</div>
                        <div className="text-[10px] text-white/30 font-medium">{tugas.kelas} · Abs {tugas.noAbsen}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs text-white/30 font-mono">{formatTanggal(tugas.submittedAt)}</td>
                  <td className="px-8 py-5">
                    <StatusBadge status={tugas.status} />
                  </td>
                  <td className="px-8 py-5 text-center">
                    {tugas.nilai !== null ? (
                      <span className={`text-lg font-bold ${nilaiColor(tugas.nilai)} text-glow`}>{tugas.nilai}</span>
                    ) : <span className="text-white/10">—</span>}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-400 transition-all">
                      {Icon.chevronRight}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>)}

        {}
        {activePageTab === 'riwayat' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
              <div className="p-6 border-b border-white/10 bg-white/5 flex flex-wrap gap-4 items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Riwayat Ujian</h3>
                  <p className="text-xs text-white/40">Pilih ujian untuk melihat hasil siswa & export PDF</p>
                </div>
                <select value={riwayatUjianId} onChange={e => setRiwayatUjianId(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none min-w-[220px]">
                  <option value="">— Pilih Ujian —</option>
                  {[...ujianList.map(u => ({ id: u.id, judul: u.judul, deleted: false })),
                    ...riwayatList.map(r => ({ id: r.id, judul: r.judul, deleted: true }))]
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.deleted ? '(Dihapus) ' : ''}{u.judul}
                      </option>
                    ))}
                </select>
              </div>

              {isLoadingRiwayat || isLoadingHasil ? (
                <div className="p-12 flex items-center justify-center gap-3 text-white/40 text-sm">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" /> Memuat...
                </div>
              ) : !riwayatUjianId ? (
                <div className="p-16 text-center text-white/20 text-sm">Pilih ujian di atas.</div>
              ) : hasilGuru.length === 0 ? (
                <div className="p-16 text-center text-white/30 text-sm">Belum ada siswa yang mengumpulkan.</div>
              ) : (
                <>
                  <div className="p-4 border-b border-white/5 bg-white/[0.02] flex gap-6 text-xs text-white/40">
                    <span>Total: <strong className="text-white">{hasilGuru.length}</strong></span>
                    <span>Dinilai: <strong className="text-emerald-400">{hasilGuru.filter(t => t.nilai !== null).length}</strong></span>
                    <span>Rata-rata: <strong className="text-indigo-400">
                      {hasilGuru.filter(t => t.nilai !== null).length > 0
                        ? (hasilGuru.filter(t => t.nilai !== null).reduce((s, t) => s + (t.nilai ?? 0), 0) / hasilGuru.filter(t => t.nilai !== null).length).toFixed(1)
                        : '—'}
                    </strong></span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          {['No', 'Nama', 'Kelas', 'No.Absen', 'Dikumpulkan', 'Status', 'Nilai', 'PDF'].map(h => (
                            <th key={h} className="px-5 py-4 text-[10px] tracking-[0.15em] text-white/30 uppercase font-bold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hasilGuru.map((t, i) => (
                          <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                            <td className="px-5 py-4 text-xs text-white/20 font-mono">{i + 1}</td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                                  {initials(t.nama)}
                                </div>
                                <span className="text-sm font-bold text-white/90">{t.nama}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-xs text-white/50">{t.kelas}</td>
                            <td className="px-5 py-4 text-xs text-white/50">{t.noAbsen}</td>
                            <td className="px-5 py-4 text-xs text-white/30 font-mono">{formatTanggal(t.submittedAt)}</td>
                            <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                            <td className="px-5 py-4">
                              {t.nilai !== null
                                ? <span className={`text-lg font-bold ${nilaiColor(t.nilai)}`}>{t.nilai}</span>
                                : <span className="text-white/20 text-xs">—</span>}
                            </td>
                            <td className="px-5 py-4">
                              <button onClick={() => handlePrintSiswa(t)}
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-all">
                                {Icon.download} PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {}
      <div id="print-area" style={{ display: 'none' }} ref={printRef}>
        {printTarget && (() => {
          const n = printTarget.nilai;
          const grade = n === null ? '—' : n >= 90 ? 'A' : n >= 75 ? 'B' : n >= 60 ? 'C' : n >= 45 ? 'D' : 'E';
          const gradeColor = n === null ? '#888' : n >= 75 ? '#16a34a' : n >= 60 ? '#d97706' : '#dc2626';
          const ujianJudul = printTarget.ujian?.judul ?? riwayatList.find(r => r.id === riwayatUjianId)?.judul ?? ujianList.find(u => u.id === riwayatUjianId)?.judul ?? 'Ujian';
          return (
            <div className="print-card" style={{ fontFamily: 'Arial, sans-serif', color: '#111', maxWidth: 680, margin: '0 auto' }}>
              {}
              <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)', color: 'white', borderRadius: 16, padding: '32px 40px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>DCC Submit Center</div>
                    <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Laporan Hasil Ujian</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>{ujianJudul}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '16px 24px', minWidth: 80 }}>
                    <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: 'white' }}>{n ?? '—'}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>Nilai</div>
                  </div>
                </div>
              </div>
              {}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[['Nama Siswa', printTarget.nama], ['Kelas', printTarget.kelas], ['No. Absen', String(printTarget.noAbsen)],
                  ['Stambuk', printTarget.stambuk || '—'], ['Tanggal Kumpul', formatTanggal(printTarget.submittedAt)],
                  ['Grade', grade], ['Status', printTarget.status], ['Format File', '.' + (printTarget.filePath?.split('.').pop()?.toUpperCase() ?? '—')]]
                  .map(([label, val]) => (
                    <div key={label} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: label === 'Grade' ? gradeColor : label === 'Nilai' ? gradeColor : '#111' }}>{val}</div>
                    </div>
                  ))}
              </div>
              {}
              {printTarget.catatan && (
                <div style={{ background: '#f0f9ff', borderRadius: 10, padding: '16px 20px', border: '1px solid #bae6fd', marginBottom: 20 }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#0369a1', fontWeight: 700, marginBottom: 8 }}>Catatan Guru</div>
                  <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.6 }}>{printTarget.catatan}</div>
                </div>
              )}
              {}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                <span>Dicetak: {new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</span>
                <span>DCC Submit Center • Sistem Ujian Digital</span>
              </div>
            </div>
          );
        })()}
      </div>

      {}
      {viewerOpen && currentTugas && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-3xl animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-blue-900/20 pointer-events-none" />

          {}
          <div className="h-20 shrink-0 border-b border-white/10 flex items-center justify-between px-10 relative z-10 bg-black/40">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300">
                {initials(currentTugas.nama)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{currentTugas.nama}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{currentTugas.kelas} · Abs {currentTugas.noAbsen}</span>
                  <StatusBadge status={currentTugas.status} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 bg-white/5 rounded-2xl px-4 py-2 border border-white/10">
                <button onClick={() => goTo(-1)} disabled={viewerIndex === 0}
                  className="p-1 text-white/40 hover:text-white disabled:opacity-20 transition-all">{Icon.chevronLeft}</button>
                <span className="text-xs font-bold text-white/80 tabular-nums min-w-[60px] text-center">{viewerIndex + 1} / {filtered.length}</span>
                <button onClick={() => goTo(1)} disabled={viewerIndex === filtered.length - 1}
                  className="p-1 text-white/40 hover:text-white disabled:opacity-20 transition-all">{Icon.chevronRight}</button>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <a href={fileUrl(currentTugas.filePath)} download target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white/40 hover:text-white transition-colors">
                {Icon.download} Download
              </a>
              <button onClick={() => setViewerOpen(false)}
                className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:bg-red-500 hover:text-white hover:border-red-400 transition-all">
                {Icon.close}
              </button>
            </div>
          </div>

          {}
          <div className="flex-1 flex overflow-hidden relative z-10">
            <div className="flex-1 overflow-auto flex items-start justify-center p-12 custom-scrollbar">
              <div className="glass-panel p-2 rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
                <FilePreview filePath={currentTugas.filePath} />
              </div>
            </div>

            {}
            <div className="w-[380px] shrink-0 border-l border-white/10 flex flex-col bg-black/40 backdrop-blur-md">
              <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                <section>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-4">Informasi Sesi</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-medium"><span className="text-white/30">Dikumpulkan</span><span className="text-white/60">{formatTanggal(currentTugas.submittedAt)}</span></div>
                    <div className="flex justify-between text-xs font-medium"><span className="text-white/30">Format File</span><span className="text-indigo-400 font-bold">.{fileExt(currentTugas.filePath).toUpperCase()}</span></div>
                  </div>
                </section>

                <section className="pt-8 border-t border-white/5">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-6">Input Penilaian</p>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] text-white/30 uppercase font-bold mb-3">Skor (0 - 100)</label>
                      <input type="number" min={0} max={100} placeholder="0" value={inputNilai} onChange={e => setInputNilai(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-4xl font-bold text-white placeholder-white/5 focus:border-indigo-500/50 outline-none transition-all tabular-nums" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-white/30 uppercase font-bold mb-3">Catatan Feedback</label>
                      <textarea rows={6} placeholder="Tulis masukan untuk siswa..." value={inputCatatan} onChange={e => setInputCatatan(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white placeholder-white/10 focus:border-indigo-500/50 outline-none transition-all resize-none" />
                    </div>
                  </div>
                </section>
              </div>

              {}
              <div className="p-8 border-t border-white/10 space-y-3">
                <button onClick={handleSimpan} disabled={isSaving || inputNilai === ''}
                  className={`w-full py-4 rounded-2xl text-xs font-bold tracking-widest uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${
                    savedId === currentTugas.id ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-[0.98] disabled:opacity-20'
                  }`}>
                  {savedId === currentTugas.id ? <>{Icon.check} Berhasil Disimpan</> : isSaving ? 'Memproses...' : 'Simpan & Lanjutkan'}
                </button>
                {viewerIndex < filtered.length - 1 && (
                  <button onClick={() => goTo(1)}
                    className="w-full py-4 rounded-2xl text-xs font-bold tracking-widest uppercase text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                    Lewati Tugas Ini
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}