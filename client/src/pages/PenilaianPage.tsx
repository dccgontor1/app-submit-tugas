import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Tugas, Ujian } from '../types';

// ── Icons ──────────────────────────────────────────────────────────────────
const Icon = {
  close: (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l10 10M13 3L3 13"/>
    </svg>
  ),
  download: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 2v8M5 7l3 3 3-3M2 13h12"/>
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 3L5 8l5 5"/>
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3l5 5-5 5"/>
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6l4 4 4-4"/>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1.5 8A6.5 6.5 0 018 1.5c2.2 0 4.1 1.1 5.3 2.7M14.5 8A6.5 6.5 0 018 14.5c-2.2 0-4.1-1.1-5.3-2.7"/>
      <path d="M12 1v4h-4M4 15v-4h4"/>
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8l3.5 3.5L13 4"/>
    </svg>
  ),
};

// ── Helpers ────────────────────────────────────────────────────────────────
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

const nilaiBg = (n: number) =>
  n >= 75
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : n >= 60
    ? 'bg-amber-500/10 border-amber-500/20'
    : 'bg-red-500/10 border-red-500/20';

const formatTanggal = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
};

// ── StatusBadge ────────────────────────────────────────────────────────────
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

// ── FilePreview ────────────────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════
export default function PenilaianPage() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

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

  // ── Fetch ──────────────────────────────────────────────
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

  useEffect(() => { fetchUjian(); }, []);
  useEffect(() => { if (selectedUjian) fetchTugas(selectedUjian); }, [selectedUjian]);

  // ── Derived ────────────────────────────────────────────
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

  // ── Viewer helpers ─────────────────────────────────────
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

  // ── Save ───────────────────────────────────────────────
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

  // ══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#080810]">

      {/* ── Navbar ── */}
      <nav className="bg-[#0c0c16]/90 backdrop-blur border-b border-white/[0.05] sticky top-0 z-40 h-14 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <span className="font-mono text-sm font-bold text-white tracking-wide">
            <span className="text-indigo-400">DCC</span>_ADMIN
          </span>
          <div className="flex items-center gap-1">
            {[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Ujian',     path: '/ujian-admin' },
              { label: 'Penilaian',path: '/penilaian' },
            ].map(({ label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`font-mono text-[10px] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm transition-all ${
                  path === '/penilaian'
                    ? 'text-white bg-white/[0.07]'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="border border-red-500/25 text-red-400/60 hover:border-red-500/55 hover:text-red-300 hover:bg-red-500/[0.05] font-mono text-[10px] tracking-[0.1em] uppercase px-3.5 py-1.5 rounded-sm transition-all"
        >
          Keluar
        </button>
      </nav>

      {/* ── Main ── */}
      <main className="max-w-5xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-indigo-400/70 uppercase mb-1.5">Panel Guru</p>
            <h1 className="font-mono text-2xl font-bold text-white">Penilaian Tugas</h1>
            <p className="text-sm text-white/25 mt-1">Klik baris siswa untuk membuka viewer full-screen.</p>
          </div>
          <button
            onClick={() => selectedUjian && fetchTugas(selectedUjian)}
            className="flex items-center gap-2 border border-white/[0.07] hover:border-white/20 text-white/25 hover:text-white/60 font-mono text-[10px] tracking-[0.1em] uppercase px-3 py-2 rounded-sm transition-all"
          >
            {Icon.refresh} Refresh
          </button>
        </div>

        {/* Pilih Ujian */}
        <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-sm p-5 mb-5">
          <label className="block font-mono text-[10px] tracking-[0.15em] text-white/30 uppercase mb-2.5">
            Pilih Ujian
          </label>
          {isLoadingUjian ? (
            <p className="font-mono text-[11px] text-white/20 animate-pulse">Memuat...</p>
          ) : (
            <div className="relative">
              <select
                value={selectedUjian}
                onChange={e => setSelectedUjian(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-sm pl-4 pr-10 py-3 text-sm text-[#ddd8d0] outline-none focus:border-indigo-500/50 transition-colors appearance-none cursor-pointer"
              >
                {ujianList.length === 0 && <option value="">Belum ada ujian</option>}
                {ujianList.map(u => (
                  <option key={u.id} value={u.id} className="bg-[#0f0f1a]">
                    {u.judul}{(u as any).deletedAt ? ' [dihapus]' : ''}
                  </option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
                {Icon.chevronDown}
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-px bg-white/[0.04] mb-5 border border-white/[0.05] rounded-sm overflow-hidden">
          {[
            { label: 'Total',     value: stats.total,    color: 'text-white' },
            { label: 'Menunggu',  value: stats.menunggu, color: 'text-amber-400' },
            { label: 'Dinilai',   value: stats.dinilai,  color: 'text-emerald-400' },
            { label: 'Rata-rata', value: stats.rataRata, color: 'text-indigo-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0f0f1a] px-6 py-4">
              <p className="font-mono text-[9px] tracking-[0.2em] text-white/20 uppercase mb-1.5">{label}</p>
              <p className={`font-mono text-3xl font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-px border-b border-white/[0.05]">
          {(['SEMUA', 'MENUNGGU', 'DINILAI', 'DIKEMBALIKAN'] as const).map(s => {
            const count =
              s === 'SEMUA'    ? stats.total :
              s === 'MENUNGGU' ? stats.menunggu :
              s === 'DINILAI'  ? stats.dinilai : null;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`font-mono text-[10px] tracking-[0.12em] uppercase px-5 py-3 transition-all border-b-2 -mb-px ${
                  filterStatus === s
                    ? 'text-white border-indigo-400'
                    : 'text-white/25 border-transparent hover:text-white/50'
                }`}
              >
                {s === 'SEMUA' ? 'Semua' : s === 'MENUNGGU' ? 'Menunggu' : s === 'DINILAI' ? 'Dinilai' : 'Dikembalikan'}
                {count !== null && (
                  <span className={`ml-1.5 text-[9px] ${filterStatus === s ? 'text-white/40' : 'text-white/18'}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-[#0f0f1a] border border-white/[0.06] border-t-0 rounded-b-sm overflow-hidden mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['#', 'Nama Siswa', 'Kelas', 'Dikumpulkan', 'Status', 'Nilai', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-5 py-2.5 font-mono text-[9px] tracking-[0.15em] text-white/18 uppercase font-normal ${
                      i === 0 || i >= 5 ? 'text-center' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingTugas ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.03]">
                    {[32, 160, 80, 120, 80, 40, 50].map((w, j) => (
                      <td key={j} className="px-5 py-4">
                        <div
                          className="h-2.5 bg-white/[0.04] rounded-sm animate-pulse mx-auto"
                          style={{ width: w }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center font-mono text-[11px] tracking-[0.2em] text-white/12 uppercase">
                    Belum ada tugas
                  </td>
                </tr>
              ) : filtered.map((tugas, idx) => (
                <tr
                  key={tugas.id}
                  onClick={() => openViewer(idx)}
                  className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.025] cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3.5 text-center font-mono text-[10px] text-white/20 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center font-mono text-[9px] font-bold text-indigo-400/70 shrink-0">
                        {initials(tugas.nama)}
                      </div>
                      <span className="text-sm font-medium text-white/75 group-hover:text-white transition-colors whitespace-nowrap">
                        {tugas.nama}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-white/30">
                    {tugas.kelas} · {tugas.noAbsen}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-white/25 whitespace-nowrap">
                    {formatTanggal(tugas.submittedAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={tugas.status} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {tugas.nilai !== null ? (
                      <span className={`font-mono text-sm font-bold tabular-nums ${nilaiColor(tugas.nilai)}`}>
                        {tugas.nilai}
                      </span>
                    ) : (
                      <span className="font-mono text-[13px] text-white/12">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-white/12 group-hover:text-indigo-400/55 transition-colors">
                      Buka →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* ════════════════════════════════════════════════════
          FULL-SCREEN VIEWER
      ════════════════════════════════════════════════════ */}
      {viewerOpen && currentTugas && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#06060a]">

          {/* Viewer topbar */}
          <div className="h-14 shrink-0 bg-[#0a0a12] border-b border-white/[0.06] flex items-center justify-between px-6 gap-4">

            {/* Student info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono text-[10px] font-bold text-indigo-400 shrink-0">
                {initials(currentTugas.nama)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate leading-tight">{currentTugas.nama}</p>
                <p className="font-mono text-[10px] text-white/30 leading-tight">
                  Kelas {currentTugas.kelas} · Absen {currentTugas.noAbsen}
                </p>
              </div>
              <div className="ml-1 shrink-0">
                <StatusBadge status={currentTugas.status} />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => goTo(-1)}
                disabled={viewerIndex === 0}
                className="w-8 h-8 flex items-center justify-center border border-white/[0.08] hover:border-white/20 text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed rounded-sm transition-all"
              >
                {Icon.chevronLeft}
              </button>
              <span className="font-mono text-[11px] text-white/30 tabular-nums min-w-[56px] text-center">
                {viewerIndex + 1} / {filtered.length}
              </span>
              <button
                onClick={() => goTo(1)}
                disabled={viewerIndex === filtered.length - 1}
                className="w-8 h-8 flex items-center justify-center border border-white/[0.08] hover:border-white/20 text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed rounded-sm transition-all"
              >
                {Icon.chevronRight}
              </button>
              <span className="font-mono text-[9px] text-white/12 ml-1">← →</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={fileUrl(currentTugas.filePath)}
                download
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 border border-white/[0.08] hover:border-white/20 text-white/30 hover:text-white/70 rounded-sm transition-all"
              >
                {Icon.download} Download
              </a>
              <button
                onClick={() => setViewerOpen(false)}
                className="w-8 h-8 flex items-center justify-center border border-white/[0.08] hover:border-red-500/40 text-white/25 hover:text-red-400 rounded-sm transition-all"
              >
                {Icon.close}
              </button>
            </div>
          </div>

          {/* Viewer body */}
          <div className="flex-1 flex overflow-hidden">

            {/* File area */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-6 bg-[#06060a]">
              <FilePreview filePath={currentTugas.filePath} />
            </div>

            {/* Grading sidebar */}
            <div className="w-[300px] shrink-0 bg-[#0a0a12] border-l border-white/[0.06] flex flex-col overflow-y-auto">

              {/* Submission meta */}
              <div className="px-6 py-5 border-b border-white/[0.05] space-y-2">
                <p className="font-mono text-[9px] tracking-[0.2em] text-white/18 uppercase mb-3">Info Pengumpulan</p>
                {[
                  { label: 'Dikumpulkan', value: formatTanggal(currentTugas.submittedAt) },
                  ...(currentTugas.dinilaiAt ? [{ label: 'Dinilai', value: formatTanggal(currentTugas.dinilaiAt) }] : []),
                  { label: 'Format', value: `.${fileExt(currentTugas.filePath).toUpperCase()}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-white/25">{label}</span>
                    <span className="font-mono text-[10px] text-white/45">{value}</span>
                  </div>
                ))}
              </div>

              {/* Current score display */}
              {currentTugas.nilai !== null && (
                <div className="px-6 py-4 border-b border-white/[0.05]">
                  <p className="font-mono text-[9px] tracking-[0.2em] text-white/18 uppercase mb-2.5">Nilai Saat Ini</p>
                  <div className={`flex items-baseline gap-1.5 px-4 py-3 rounded-sm border ${nilaiBg(currentTugas.nilai)}`}>
                    <span className={`font-mono text-5xl font-bold tabular-nums leading-none ${nilaiColor(currentTugas.nilai)}`}>
                      {currentTugas.nilai}
                    </span>
                    <span className={`font-mono text-base ${nilaiColor(currentTugas.nilai)} opacity-40`}>/100</span>
                  </div>
                  {currentTugas.catatan && (
                    <p className="text-[11px] text-white/28 mt-2.5 leading-relaxed italic">"{currentTugas.catatan}"</p>
                  )}
                </div>
              )}

              {/* Form */}
              <div className="px-6 py-5 flex-1 flex flex-col gap-4">
                <p className="font-mono text-[9px] tracking-[0.2em] text-white/18 uppercase">
                  {currentTugas.nilai !== null ? 'Edit Penilaian' : 'Beri Nilai'}
                </p>

                <div>
                  <label className="block font-mono text-[10px] text-white/28 uppercase tracking-[0.12em] mb-2">
                    Nilai <span className="normal-case tracking-normal text-white/15">(0–100)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0"
                    value={inputNilai}
                    onChange={e => setInputNilai(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-sm px-4 py-3 font-mono text-4xl font-bold text-white placeholder-white/10 outline-none focus:border-indigo-500/50 focus:bg-indigo-500/[0.03] transition-colors tabular-nums"
                  />
                </div>

                <div className="flex-1">
                  <label className="block font-mono text-[10px] text-white/28 uppercase tracking-[0.12em] mb-2">
                    Catatan <span className="normal-case tracking-normal text-white/15">(opsional)</span>
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Tulis feedback untuk siswa..."
                    value={inputCatatan}
                    onChange={e => setInputCatatan(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-sm px-4 py-3 text-sm text-[#bbb8b0] placeholder-white/12 outline-none focus:border-indigo-500/50 focus:bg-indigo-500/[0.03] transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Save — sticky bottom */}
              <div className="px-6 py-5 border-t border-white/[0.05] space-y-2">
                <button
                  onClick={handleSimpan}
                  disabled={isSaving || inputNilai === ''}
                  className={`w-full flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-3.5 rounded-sm transition-all ${
                    savedId === currentTugas.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-indigo-500 hover:bg-indigo-600 active:scale-[0.99] disabled:opacity-25 disabled:cursor-not-allowed text-white'
                  }`}
                >
                  {savedId === currentTugas.id
                    ? <>{Icon.check} Tersimpan</>
                    : isSaving
                    ? 'Menyimpan...'
                    : viewerIndex < filtered.length - 1
                    ? 'Simpan & Lanjut →'
                    : 'Simpan Nilai'}
                </button>

                {viewerIndex < filtered.length - 1 && (
                  <button
                    onClick={() => goTo(1)}
                    className="w-full font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 border border-white/[0.07] hover:border-white/15 text-white/20 hover:text-white/50 rounded-sm transition-all"
                  >
                    Lewati →
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