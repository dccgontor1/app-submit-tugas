import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Akun, Sesi } from '../types';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'akun' | 'sesi'>('akun');

  const [akunList, setAkunList] = useState<Akun[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newAkun, setNewAkun] = useState({ nama: '', username: '', password: '', role: 'GURU' });
  const [selectedAkun, setSelectedAkun] = useState<Set<number>>(new Set());

  const [sesiList, setSesiList] = useState<Sesi[]>([]);
  const [isLoadingSesi, setIsLoadingSesi] = useState(false);
  const [selectedSesi, setSelectedSesi] = useState<Set<string>>(new Set());

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<any[]>([]);
  const [csvPreviewFile, setCsvPreviewFile] = useState<File | null>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  const fetchAkun = async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const res = await fetch('http://localhost:5000/admin/akun', { credentials: 'include' });
      if (res.status === 401) return navigate('/401');
      if (res.status === 403) return navigate('/403');
      if (!res.ok) throw new Error();
      setAkunList(await res.json());
      setSelectedAkun(new Set());
    } catch {
      setAkunList([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchSesi = async () => {
    if (!user) return;
    setIsLoadingSesi(true);
    try {
      const res = await fetch('http://localhost:5000/admin/sesi', { credentials: 'include' });
      if (res.status === 401) return navigate('/401');
      if (res.status === 403) return navigate('/403');
      if (!res.ok) throw new Error();
      setSesiList(await res.json());
      setSelectedSesi(new Set());
    } catch {
      setSesiList([]);
    } finally {
      setIsLoadingSesi(false);
    }
  };

  const handleCreateAkun = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/admin/akun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newAkun),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal membuat akun');
      setShowModal(false);
      setNewAkun({ nama: '', username: '', password: '', role: 'GURU' });
      fetchAkun();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Bulk delete akun ──────────────────────────────────
  const handleDeleteAkun = async (id: number, nama: string) => {
    if (!window.confirm(`Hapus akun ${nama}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/admin/akun/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error();
      setAkunList(prev => prev.filter(a => a.id !== id));
      setSelectedAkun(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch { alert('Gagal menghapus'); }
  };

  const handleBulkDeleteAkun = async () => {
    if (selectedAkun.size === 0) return;
    if (!window.confirm(`Hapus ${selectedAkun.size} akun sekaligus?`)) return;
    // ✅ Fix: cek setiap response, hanya hapus dari state yang berhasil
    const results = await Promise.all(
      [...selectedAkun].map(async id => {
        const res = await fetch(`http://localhost:5000/admin/akun/${id}`, { method: 'DELETE', credentials: 'include' });
        return { id, ok: res.ok };
      })
    );
    const successIds = new Set(results.filter(r => r.ok).map(r => r.id));
    if (results.some(r => !r.ok)) alert('Beberapa akun gagal dihapus');
    setAkunList(prev => prev.filter(a => !successIds.has(a.id)));
    setSelectedAkun(new Set());
  };

  const toggleSelectAkun = (id: number) =>
    setSelectedAkun(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleSelectAllAkun = () =>
    setSelectedAkun(selectedAkun.size === akunList.length ? new Set() : new Set(akunList.map(a => a.id)));

  // ── Bulk delete sesi ──────────────────────────────────
  const handleDeleteSesi = async (sesiToken: string, nama: string) => {
    if (!window.confirm(`Hapus sesi ${nama}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/admin/sesi/${sesiToken}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error();
      setSesiList(prev => prev.filter(s => s.token !== sesiToken));
      setSelectedSesi(prev => { const s = new Set(prev); s.delete(sesiToken); return s; });
    } catch { alert('Gagal menghapus sesi'); }
  };

  const handleBulkDeleteSesi = async () => {
    if (selectedSesi.size === 0) return;
    if (!window.confirm(`Hapus ${selectedSesi.size} sesi sekaligus?`)) return;
    // ✅ Fix: cek setiap response, hanya hapus dari state yang berhasil
    const results = await Promise.all(
      [...selectedSesi].map(async token => {
        const res = await fetch(`http://localhost:5000/admin/sesi/${token}`, { method: 'DELETE', credentials: 'include' });
        return { token, ok: res.ok };
      })
    );
    const successTokens = new Set(results.filter(r => r.ok).map(r => r.token));
    if (results.some(r => !r.ok)) alert('Beberapa sesi gagal dihapus');
    setSesiList(prev => prev.filter(s => !successTokens.has(s.token)));
    setSelectedSesi(new Set());
  };

  const toggleSelectSesi = (token: string) =>
    setSelectedSesi(prev => { const s = new Set(prev); s.has(token) ? s.delete(token) : s.add(token); return s; });

  const toggleSelectAllSesi = () =>
    setSelectedSesi(selectedSesi.size === sesiList.length ? new Set() : new Set(sesiList.map(s => s.token)));

  // ── CSV Preview ───────────────────────────────────────
  const handlePreviewCSV = (file: File) => {
    setCsvPreviewFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;
      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const values = line.split(';').map(v => v.trim());
        const row: any = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
        return row;
      }).filter(row => row.nama);
      setCsvPreviewData(rows);
      setShowCsvPreview(true);
    };
    reader.readAsText(file);
  };

  const handleConfirmUpload = async () => {
    if (!csvPreviewFile) return;
    const formData = new FormData();
    formData.append('file', csvPreviewFile);
    setIsUploading(true);
    setShowCsvPreview(false);
    try {
      const res = await fetch('http://localhost:5000/admin/generate', {
        method: 'POST', credentials: 'include', body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      alert(`Berhasil! ${data.totalData} sesi dibuat.`);
      setCsvFile(null);
      setCsvPreviewFile(null);
      setCsvPreviewData([]);
      if (previewInputRef.current) previewInputRef.current.value = '';
      fetchSesi();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => { fetchAkun(); fetchSesi(); }, []);

  const adminCount = akunList.filter(a => a.role === 'ADMIN').length;
  const now = new Date();
  const sesiAktif   = sesiList.filter(s => new Date(s.deadline) > now).length;
  const sesiExpired = sesiList.filter(s => new Date(s.deadline) <= now).length;
  const isExpired = (d: string) => new Date(d) <= now;
  const formatDeadline = (d: string) =>
    new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

  const cb = "w-3.5 h-3.5 rounded-[2px] cursor-pointer accent-indigo-500";

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navbar */}
      <nav className="bg-[#0d0d14] border-b border-white/[0.06] sticky top-0 z-40 h-14 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <span className="font-mono text-sm font-bold text-white tracking-wide">
            <span className="text-indigo-400">DCC</span>_ADMIN
          </span>
          <div className="flex items-center gap-1">
            {[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Ujian', path: '/ujian-admin' }, { label: 'Penilaian', path: '/penilaian' }].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`font-mono text-[10px] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm transition-all ${path === '/dashboard' ? 'text-white bg-white/[0.06]' : 'text-white/35 hover:text-white/60'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-white/30">{user?.nama}</span>
          <button onClick={handleLogout} className="border border-red-500/30 text-red-400/70 hover:border-red-500/70 hover:text-red-300 hover:bg-red-500/[0.06] font-mono text-[10px] tracking-[0.1em] uppercase px-3.5 py-1.5 rounded-sm transition-all">Keluar</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10 flex-wrap gap-4">
          <div>
            <h1 className="font-mono text-2xl font-bold text-white leading-tight mb-1.5">Dashboard<br />Pengelolaan</h1>
            <p className="text-sm text-white/30">Kelola akses guru dan sesi ujian siswa.</p>
          </div>
          {user?.role === 'ADMIN' && (
            <button onClick={() => setShowModal(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[11px] tracking-[0.08em] uppercase px-5 py-2.5 rounded-sm transition-colors active:scale-[0.98] shrink-0">
              + Buat Akun
            </button>
          )}
        </div>

        {/* Stat Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05] mb-6 border border-white/[0.05] rounded-sm overflow-hidden">
          {[
            { label: 'Total Staff',  value: akunList.length, color: 'text-white' },
            { label: 'Admin',        value: adminCount,       color: 'text-indigo-300' },
            { label: 'Sesi Aktif',   value: sesiAktif,        color: 'text-emerald-300' },
            { label: 'Sesi Expired', value: sesiExpired,      color: 'text-red-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#13131a] px-6 py-5">
              <p className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase mb-2">{label}</p>
              <p className={`font-mono text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* CSV Card */}
        {user?.role === 'ADMIN' && (
          <div className="bg-[#13131a] border border-white/[0.07] rounded-sm p-6 mb-6">
            <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-white/50 mb-1">Bulk Import — CSV</p>
            <p className="text-[11px] text-white/20 mb-4">File akan dipreview sebelum diupload.</p>
            <div className="flex gap-3 flex-wrap items-center">
              <input ref={previewInputRef} type="file" accept=".csv"
                onChange={e => { const f = e.target.files?.[0] || null; setCsvFile(f); if (f) handlePreviewCSV(f); }}
                className="flex-1 min-w-40 text-sm text-white/50 bg-white/[0.03] border border-white/[0.08] rounded-sm px-3 py-2 cursor-pointer file:bg-white/[0.07] file:border-0 file:rounded-sm file:text-white/60 file:font-mono file:text-[9px] file:tracking-[0.1em] file:uppercase file:px-2.5 file:py-1 file:mr-2.5 file:cursor-pointer file:hover:bg-white/[0.12] file:transition-colors"
              />
              {csvFile && (
                <button onClick={() => csvFile && handlePreviewCSV(csvFile)}
                  className="border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/10 font-mono text-[10px] tracking-[0.08em] uppercase px-4 py-2.5 rounded-sm transition-all">
                  Preview Ulang
                </button>
              )}
            </div>
            <p className="text-[11px] text-white/20 italic mt-3">Format kolom: nama;kelas;noAbsen;ujianId;deadline</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-px mb-0 border-b border-white/[0.06]">
          {(['akun', 'sesi'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`font-mono text-[10px] tracking-[0.15em] uppercase px-6 py-3 transition-all border-b-2 -mb-px ${activeTab === tab ? 'text-white border-indigo-400' : 'text-white/30 border-transparent hover:text-white/60'}`}>
              {tab === 'akun' ? `Akun Staff (${akunList.length})` : `Sesi Ujian (${sesiList.length})`}
            </button>
          ))}
        </div>

        {/* Tab: Akun */}
        {activeTab === 'akun' && (
          <div className="bg-[#13131a] border border-white/[0.07] border-t-0 rounded-b-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center">
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-white/50">
                Daftar Akun Staff
                {selectedAkun.size > 0 && <span className="ml-2 text-indigo-300">({selectedAkun.size} dipilih)</span>}
              </span>
              <div className="flex items-center gap-2">
                {user?.role === 'ADMIN' && selectedAkun.size > 0 && (
                  <button onClick={handleBulkDeleteAkun}
                    className="bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-sm transition-all">
                    Hapus {selectedAkun.size} Akun
                  </button>
                )}
                <button onClick={fetchAkun} className="font-mono text-[10px] tracking-[0.08em] text-indigo-400 uppercase px-2 py-1 rounded-sm hover:bg-indigo-500/10 transition-colors">
                  {isLoadingData ? 'Memuat...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                    {user?.role === 'ADMIN' && (
                      <th className="px-4 py-2.5 w-10">
                        <input type="checkbox" className={cb}
                          checked={akunList.length > 0 && selectedAkun.size === akunList.length}
                          onChange={toggleSelectAllAkun} />
                      </th>
                    )}
                    {['Nama Lengkap', 'Username', 'Role', 'Aksi'].map((h, i) => (
                      <th key={h} className={`px-6 py-2.5 font-mono text-[9px] tracking-[0.15em] text-white/20 uppercase font-normal text-left ${i === 3 ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {akunList.length === 0 ? (
                    <tr><td colSpan={user?.role === 'ADMIN' ? 5 : 4} className="px-6 py-10 text-center font-mono text-[11px] text-white/15 uppercase">Belum ada akun terdaftar</td></tr>
                  ) : akunList.map(akun => (
                    <tr key={akun.id} className={`border-b border-white/[0.04] last:border-0 transition-colors ${selectedAkun.has(akun.id) ? 'bg-indigo-500/[0.05]' : 'hover:bg-white/[0.02]'}`}>
                      {user?.role === 'ADMIN' && (
                        <td className="px-4 py-3.5">
                          <input type="checkbox" className={cb} checked={selectedAkun.has(akun.id)} onChange={() => toggleSelectAkun(akun.id)} />
                        </td>
                      )}
                      <td className="px-6 py-3.5 text-sm font-medium text-white">{akun.nama}</td>
                      <td className="px-6 py-3.5 font-mono text-[11px] text-white/40">{akun.username}</td>
                      <td className="px-6 py-3.5">
                        <span className={`font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 rounded-[1px] border ${akun.role === 'ADMIN' ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' : 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20'}`}>
                          {akun.role}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {user?.role === 'ADMIN' ? (
                          <button onClick={() => handleDeleteAkun(akun.id, akun.nama)}
                            className="border border-transparent hover:border-red-500/40 text-red-400/50 hover:text-red-300 hover:bg-red-500/[0.06] font-mono text-[9px] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm transition-all">
                            Hapus
                          </button>
                        ) : <span className="font-mono text-[9px] text-white/15">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Sesi */}
        {activeTab === 'sesi' && (
          <div className="bg-[#13131a] border border-white/[0.07] border-t-0 rounded-b-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center">
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-white/50">
                Daftar Sesi Ujian
                {selectedSesi.size > 0 && <span className="ml-2 text-indigo-300">({selectedSesi.size} dipilih)</span>}
              </span>
              <div className="flex items-center gap-2">
                {user?.role === 'ADMIN' && selectedSesi.size > 0 && (
                  <button onClick={handleBulkDeleteSesi}
                    className="bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-sm transition-all">
                    Hapus {selectedSesi.size} Sesi
                  </button>
                )}
                <button onClick={fetchSesi} className="font-mono text-[10px] tracking-[0.08em] text-indigo-400 uppercase px-2 py-1 rounded-sm hover:bg-indigo-500/10 transition-colors">
                  {isLoadingSesi ? 'Memuat...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                    {user?.role === 'ADMIN' && (
                      <th className="px-4 py-2.5 w-10">
                        <input type="checkbox" className={cb}
                          checked={sesiList.length > 0 && selectedSesi.size === sesiList.length}
                          onChange={toggleSelectAllSesi} />
                      </th>
                    )}
                    {['Nama Siswa', 'Kelas', 'No.', 'Ujian', 'Token', 'Deadline', 'Status', 'Aksi'].map((h, i) => (
                      <th key={h} className={`px-6 py-2.5 font-mono text-[9px] tracking-[0.15em] text-white/20 uppercase font-normal text-left ${i === 7 ? 'text-center' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sesiList.length === 0 ? (
                    <tr><td colSpan={user?.role === 'ADMIN' ? 9 : 8} className="px-6 py-10 text-center font-mono text-[11px] text-white/15 uppercase">Belum ada sesi terdaftar</td></tr>
                  ) : sesiList.map(sesi => (
                    <tr key={sesi.token} className={`border-b border-white/[0.04] last:border-0 transition-colors ${selectedSesi.has(sesi.token) ? 'bg-indigo-500/[0.05]' : 'hover:bg-white/[0.02]'}`}>
                      {user?.role === 'ADMIN' && (
                        <td className="px-4 py-3.5">
                          <input type="checkbox" className={cb} checked={selectedSesi.has(sesi.token)} onChange={() => toggleSelectSesi(sesi.token)} />
                        </td>
                      )}
                      <td className="px-6 py-3.5 text-sm font-medium text-white whitespace-nowrap">{sesi.nama}</td>
                      <td className="px-6 py-3.5 font-mono text-[11px] text-white/40">{sesi.kelas}</td>
                      <td className="px-6 py-3.5 font-mono text-[11px] text-white/40 text-center">{sesi.noAbsen}</td>
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-[1px]">{sesi.ujianId}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-[11px] tracking-[0.2em] text-amber-300/70 bg-amber-500/10 border border-amber-500/15 px-2 py-1 rounded-[1px] select-all">{sesi.token}</span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-[11px] text-white/35 whitespace-nowrap">{formatDeadline(sesi.deadline)}</td>
                      <td className="px-6 py-3.5">
                        {isExpired(sesi.deadline)
                          ? <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 bg-red-500/10 text-red-300/70 border border-red-500/15 rounded-[1px]">Expired</span>
                          : <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-[1px]">Aktif</span>
                        }
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {user?.role === 'ADMIN' ? (
                          <button onClick={() => handleDeleteSesi(sesi.token, sesi.nama)}
                            className="border border-transparent hover:border-red-500/40 text-red-400/50 hover:text-red-300 hover:bg-red-500/[0.06] font-mono text-[9px] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm transition-all">
                            Hapus
                          </button>
                        ) : <span className="font-mono text-[9px] text-white/15">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal Buat Akun */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-[#13131a] border border-white/10 rounded-sm w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center">
              <span className="font-mono text-xs tracking-[0.1em] uppercase text-white/70">Buat Akun Baru</span>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white/70 text-base leading-none transition-colors">✕</button>
            </div>
            <form onSubmit={handleCreateAkun}>
              <div className="p-6 space-y-5">
                {[
                  { label: 'Nama Lengkap', key: 'nama',     type: 'text',     placeholder: 'Contoh: Budi Santoso' },
                  { label: 'Username',     key: 'username', type: 'text',     placeholder: 'Contoh: guru_fisika' },
                  { label: 'Password',     key: 'password', type: 'password', placeholder: '••••••••' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">{label}</label>
                    <input type={type} required placeholder={placeholder}
                      value={newAkun[key as keyof typeof newAkun]}
                      onChange={e => setNewAkun({ ...newAkun, [key]: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-sm px-4 py-3 text-sm text-[#e8e6e0] placeholder-white/20 outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 transition-colors" />
                  </div>
                ))}
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">Role / Jabatan</label>
                  <select value={newAkun.role} onChange={e => setNewAkun({ ...newAkun, role: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm px-4 py-3 text-sm text-[#e8e6e0] outline-none focus:border-indigo-500/60 focus:bg-indigo-500/5 transition-colors appearance-none">
                    <option value="GURU">Guru</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2.5 justify-end">
                <button type="button" onClick={() => setShowModal(false)}
                  className="border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-all">Batal</button>
                <button type="submit"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-colors">Simpan Akun</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CSV Preview */}
      {showCsvPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowCsvPreview(false); }}>
          <div className="bg-[#13131a] border border-white/10 rounded-sm w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center shrink-0">
              <div>
                <span className="font-mono text-xs tracking-[0.1em] uppercase text-white/70">Preview Data CSV</span>
                <p className="font-mono text-[11px] text-white/30 mt-0.5">{csvPreviewData.length} baris ditemukan</p>
              </div>
              <button onClick={() => setShowCsvPreview(false)} className="text-white/30 hover:text-white/70 text-base leading-none transition-colors">✕</button>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-[#0d0d14]">
                  <tr className="border-b border-white/[0.06]">
                    {['#', 'Nama', 'Kelas', 'No. Absen', 'Ujian ID', 'Deadline', 'Status'].map(h => (
                      <th key={h} className="px-4 py-2.5 font-mono text-[9px] tracking-[0.15em] text-white/20 uppercase font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreviewData.map((row, i) => {
                    const valid = row.nama && row.kelas && row.noabsen && row.ujianid;
                    return (
                      <tr key={i} className={`border-b border-white/[0.03] ${valid ? '' : 'bg-red-500/[0.04]'}`}>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-white/20">{i + 1}</td>
                        <td className="px-4 py-2.5 text-sm text-white">{row.nama || <span className="text-red-400/60 text-[11px]">kosong</span>}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-white/50">{row.kelas || '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-white/50">{row.noabsen || '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-indigo-300/70">{row.ujianid || <span className="text-red-400/60">—</span>}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-white/40">{row.deadline || <span className="text-amber-400/60">—</span>}</td>
                        <td className="px-4 py-2.5">
                          {valid
                            ? <span className="font-mono text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-[1px]">OK</span>
                            : <span className="font-mono text-[9px] text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-[1px]">Error</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-white/[0.06] flex justify-between items-center shrink-0">
              <p className="font-mono text-[11px] text-white/25">
                <span className="text-emerald-300/70">{csvPreviewData.filter(r => r.nama && r.kelas && r.noabsen && r.ujianid).length} valid</span>
                {' · '}
                <span className="text-red-300/60">{csvPreviewData.filter(r => !r.nama || !r.kelas || !r.noabsen || !r.ujianid).length} error</span>
              </p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowCsvPreview(false)}
                  className="border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-all">Batal</button>
                <button onClick={handleConfirmUpload} disabled={isUploading}
                  className="bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-colors">
                  {isUploading ? 'Mengupload...' : 'Konfirmasi Upload →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}