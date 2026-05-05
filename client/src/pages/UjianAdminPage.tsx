import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Ujian, Sesi } from '../types';
import {
  CheckCircle,
  ArrowRight,
  Clock,
  Plus,
  Trash2,
  LogOut,
  RefreshCw,
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Zap
} from 'lucide-react';

const FORMAT_OPTIONS = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png'];

export default function UjianAdminPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [ujianList, setUjianList] = useState<Ujian[]>([]);
  const [selectedUjian, setSelectedUjian] = useState<Ujian | null>(null);
  const [sesiList, setSesiList] = useState<Sesi[]>([]);
  const [showBuatModal, setShowBuatModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState<Sesi | null>(null);
  const [tambahMenit, setTambahMenit] = useState(10);
  const [polling, setPolling] = useState(false);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [kelasList, setKelasList] = useState<string[]>([]);
  const [batchKelas, setBatchKelas] = useState<string[]>([]);
  const [batchDeadline, setBatchDeadline] = useState('');
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  const [form, setForm] = useState({
    judul: '',
    deskripsi: '',
    formatFile: ['pdf'] as string[],
    durasi: 90,
  });

  const fetchUjian = async () => {
    const res = await fetch('http://localhost:5000/admin/ujian', { credentials: 'include' });
    if (res.status === 401) return navigate('/401');
    if (!res.ok) return;
    setUjianList(await res.json());
  };

  const fetchMonitor = useCallback(async (id: string) => {
    const res = await fetch(`http://localhost:5000/admin/ujian/${id}/monitor`, { credentials: 'include' });
    if (!res.ok) return;
    setSesiList(await res.json());
  }, []);

  const fetchKelas = async () => {
    const res = await fetch('http://localhost:5000/admin/siswa/kelas', { credentials: 'include' });
    if (res.ok) setKelasList(await res.json());
  };

  useEffect(() => { fetchUjian(); fetchKelas(); }, []);

  useEffect(() => {
    if (!selectedUjian || selectedUjian.status !== 'BERLANGSUNG') return;
    setPolling(true);
    const iv = setInterval(() => fetchMonitor(selectedUjian.id), 5000);
    return () => { clearInterval(iv); setPolling(false); };
  }, [selectedUjian, fetchMonitor]);

  const handleSelectUjian = (u: Ujian) => {
    setSelectedUjian(u);
    fetchMonitor(u.id);
  };

  const handleBuatUjian = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/admin/ujian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    });
    if (!res.ok) return alert('Gagal membuat ujian');
    setShowBuatModal(false);
    setForm({ judul: '', deskripsi: '', formatFile: ['pdf'], durasi: 90 });
    fetchUjian();
  };

  const handleStart = async () => {
    if (!selectedUjian) return;
    if (!window.confirm(`Mulai ujian "${selectedUjian.judul}" sekarang? Semua siswa akan diberi timer.`)) return;
    const res = await fetch(`http://localhost:5000/admin/ujian/${selectedUjian.id}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return alert('Gagal memulai ujian');
    const freshRes = await fetch('http://localhost:5000/admin/ujian', { credentials: 'include' });
    if (freshRes.ok) {
      const freshList: Ujian[] = await freshRes.json();
      setUjianList(freshList);
      const updated = freshList.find(u => u.id === selectedUjian.id);
      if (updated) setSelectedUjian(updated);
    }
    fetchMonitor(selectedUjian.id);
  };

  const handleExtend = async (e: FormEvent) => {
    e.preventDefault();
    if (!showExtendModal || !selectedUjian) return;
    const res = await fetch(`http://localhost:5000/admin/ujian/${selectedUjian.id}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: showExtendModal.token, tambahMenit }),
    });
    if (!res.ok) return alert('Gagal extend waktu');
    setShowExtendModal(null);
    fetchMonitor(selectedUjian.id);
  };

  const handleHapusUjian = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus ujian "${judul}"? Semua sesi akan terhapus dan muncul di riwayat.`)) return;
    try {
      const res = await fetch(`http://localhost:5000/admin/ujian/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Gagal menghapus'); }
      setSelectedUjian(null);
      fetchUjian();
    } catch (error: any) { alert(error.message); }
  };

  const handleBatchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUjian || batchKelas.length === 0 || !batchDeadline) return;
    setIsBatchLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/admin/ujian/${selectedUjian.id}/generate-sesi-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kelasList: batchKelas, deadline: batchDeadline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal');
      alert(`Berhasil! ${data.created} sesi dibuat, ${data.updated} diperbarui.`);
      setShowBatchModal(false);
      setBatchKelas([]);
      setBatchDeadline('');
      fetchMonitor(selectedUjian.id);
      fetchUjian();
    } catch (err: any) { alert(err.message); }
    finally { setIsBatchLoading(false); }
  };

  const toggleFormat = (fmt: string) => {
    setForm(prev => ({
      ...prev,
      formatFile: prev.formatFile.includes(fmt)
        ? prev.formatFile.filter(f => f !== fmt)
        : [...prev.formatFile, fmt],
    }));
  };

  const now = new Date();
  const isExpired = (deadline: string | null) => deadline ? new Date(deadline) <= now : false;
  const formatTime = (d: string) => new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(d));

  const statusColor: Record<string, string> = {
    MENUNGGU: 'bg-white/10 text-white/40 border-white/15',
    BERLANGSUNG: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    SELESAI: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  };

  const orbs = (
    <>
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-float pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: '2s' }} />
    </>
  );

  const groupedBatches = sesiList.reduce<Record<string, Sesi[]>>((acc, s) => {
    const key = s.deadline ? new Date(s.deadline).getTime().toString() : 'no-deadline';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});
  const sortedBatches = Object.keys(groupedBatches).sort((a, b) => Number(a) - Number(b));

  const handleDeleteSesi = async (token: string, nama: string) => {
    if (!confirm(`Hapus sesi atas nama ${nama}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/admin/sesi/${token}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Gagal hapus');
      if (selectedUjian) fetchMonitor(selectedUjian.id);
    } catch (e) {
      alert('Gagal menghapus sesi');
    }
  };

  const handleDeleteBatch = async (batchKey: string) => {
    if (!confirm('Hapus seluruh sesi dalam batch ini?')) return;
    try {
      const tokens = groupedBatches[batchKey].map(s => s.token);
      await Promise.all(tokens.map(t => fetch(`http://localhost:5000/admin/sesi/${t}`, { method: 'DELETE', credentials: 'include' })));
      if (selectedUjian) fetchMonitor(selectedUjian.id);
    } catch (e) {
      alert('Terjadi kesalahan saat menghapus batch');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050a]">
      {orbs}

      {}
      <nav className="glass-panel sticky top-0 z-40 h-16 flex items-center justify-between px-8 border-b border-white/[0.05]">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">U</span>
            </div>
            DCC<span className="text-cyan-400 font-light">Admin</span>
          </span>
          <div className="flex items-center gap-2">
            {[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Ujian', path: '/ujian-admin' }, { label: 'Penilaian', path: '/penilaian' }].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`text-xs font-medium px-4 py-2 rounded-xl transition-all ${path === '/ujian-admin' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {polling && <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Live</span></div>}
          <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all border border-red-500/20">
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </nav>

      {}
      <div className="border-b border-white/[0.05] bg-black/20 backdrop-blur-sm px-8 py-4 flex items-center gap-4 overflow-x-auto relative z-10">
        <button onClick={() => setShowBuatModal(true)}
          className="shrink-0 flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all">
          <Plus className="w-4 h-4" />
          Buat Ujian
        </button>
        <button onClick={() => fetchUjian()}
          className="shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <div className="w-px h-8 bg-white/10 mx-2 shrink-0" />
        <div className="flex gap-2">
          {ujianList.map(u => (
            <button key={u.id} onClick={() => handleSelectUjian(u)}
              className={`shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border transition-all text-left min-w-[160px] ${
                selectedUjian?.id === u.id
                  ? 'bg-blue-600/20 border-blue-500/30'
                  : 'bg-black/40 border-white/5 hover:bg-white/5'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white truncate max-w-[120px]">{u.judul}</span>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${statusColor[u.status]}`}>
                {u.status === 'MENUNGGU' ? 'Tunggu' : u.status === 'BERLANGSUNG' ? 'Live' : 'Selesai'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <main className="p-8 relative z-10">
        {!selectedUjian ? (
          <div className="flex flex-col items-center justify-center h-[60vh] opacity-50">
            <LayoutDashboard className="w-16 h-16 text-white/20 mb-4" />
            <p className="text-white/40 font-medium">Pilih ujian di atas untuk melihat detail</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-7xl mx-auto">
            {}
            <div className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-all duration-700" />

              <div className="flex justify-between items-start gap-8 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-lg border ${statusColor[selectedUjian.status]}`}>
                      {selectedUjian.status}
                    </span>
                    <span className="text-white/30 text-sm font-mono">{selectedUjian.id}</span>
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">{selectedUjian.judul}</h1>
                  <p className="text-white/50">{selectedUjian.deskripsi}</p>
                </div>

                <div className="flex gap-3">
                  {selectedUjian.status === 'MENUNGGU' && (
                    <button onClick={handleStart} className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all">
                      <Zap className="w-4 h-4" />
                      Mulai Ujian
                    </button>
                  )}
                  <button onClick={() => setShowBatchModal(true)} className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all">
                    <Plus className="w-4 h-4" />
                    Batch Sesi
                  </button>
                  <button onClick={() => handleHapusUjian(selectedUjian.id, selectedUjian.judul)} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                    Hapus
                  </button>
                </div>
              </div>

              <div className="flex gap-6 mt-8 pt-6 border-t border-white/5">
                <div className="flex items-center gap-2 text-white/40 text-sm"><Clock className="w-4 h-4 text-blue-400" /> {selectedUjian.durasi} Menit</div>
                <div className="flex items-center gap-2 text-white/40 text-sm"><FileText className="w-4 h-4 text-emerald-400" /> {selectedUjian.formatFile.join(', ').toUpperCase()}</div>
                <div className="flex items-center gap-2 text-white/40 text-sm"><ClipboardCheck className="w-4 h-4 text-cyan-400" /> {sesiList.length} Siswa</div>
              </div>
            </div>

            {selectedUjian.status === 'SELESAI' ? (
              <div className="glass-panel rounded-3xl border border-indigo-500/20 p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-white">Ujian Selesai</h2>
                <p className="text-white/40 text-sm">{sesiList.length} siswa terdaftar · Lihat hasil di halaman Penilaian</p>
                <button onClick={() => navigate('/penilaian')} className="flex items-center gap-2 mx-auto bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold tracking-wider uppercase px-6 py-3 rounded-xl transition-all">
                  Ke Penilaian
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedBatches.map((batchKey, i) => {
                  const batchSiswa = groupedBatches[batchKey];
                  const kelasDalamBatch = Array.from(new Set(batchSiswa.map(s => s.kelas))).sort();
                  return (
                    <div key={batchKey} className="glass-panel rounded-2xl overflow-hidden border border-white/10 relative group/batch">
                      <button onClick={() => handleDeleteBatch(batchKey)} className="absolute top-3.5 right-4 text-[10px] font-bold text-red-500/0 group-hover/batch:text-red-400 bg-red-500/0 group-hover/batch:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all z-10">Hapus Batch</button>
                      <div className="px-5 py-3.5 bg-white/[0.02] border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center"><span className="text-blue-300 font-bold text-[11px]">B{i+1}</span></div>
                          <span className="text-sm font-bold text-white">Batch {i+1} <span className="text-[10px] text-blue-300 ml-1 font-normal">({kelasDalamBatch.join(', ')})</span></span>
                          <span className="text-[10px] text-white/30">— {batchSiswa.length} siswa</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold pr-24">
                          <span className="text-emerald-400">Aktif: {batchSiswa.filter(s => s.startedAt && !isExpired(s.deadline)).length}</span>
                          <span className="text-red-400">Habis: {batchSiswa.filter(s => isExpired(s.deadline)).length}</span>
                          {batchSiswa[0]?.deadline && <span className="font-mono text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg">⏱ {formatTime(batchSiswa[0].deadline)}</span>}
                        </div>
                      </div>
                      <table className="w-full text-left">
                        <thead><tr className="border-b border-white/5 bg-white/[0.01]">
                          {['No', 'Nama', 'Kelas', 'Token', 'Status', 'Aksi'].map((h, idx) => <th key={h} className={`px-5 py-3 text-[10px] text-white/20 uppercase tracking-widest font-bold ${idx === 5 ? 'text-center' : ''}`}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {batchSiswa.map(sesi => {
                            const on = !!sesi.startedAt, exp = isExpired(sesi.deadline);
                            const cls = !on ? 'text-white/30 bg-white/5 border-white/10' : exp ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                            return (
                              <tr key={sesi.token} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] group relative">
                                <td className="px-5 py-3 text-xs text-white/20 font-mono">{sesi.noAbsen}</td>
                                <td className="px-5 py-3"><div className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{sesi.nama}</div><div className="text-[10px] text-white/20">{sesi.stambuk || '-'}</div></td>
                                <td className="px-5 py-3"><span className="text-xs text-white/50">{sesi.kelas}</span></td>
                                <td className="px-5 py-3"><span className="font-mono text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded">{sesi.token}</span></td>
                                <td className="px-5 py-3"><span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg border ${cls}`}>{!on ? 'Tunggu' : exp ? 'Habis' : 'Aktif'}</span></td>
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => { setShowExtendModal(sesi); setTambahMenit(10); }} className="text-[10px] font-bold uppercase px-3 py-1.5 bg-white/5 hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-all">+Waktu</button>
                                    <button onClick={() => handleDeleteSesi(sesi.token, sesi.nama)} className="text-[10px] font-bold uppercase px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 border border-white/10 hover:border-red-500/30 rounded-lg transition-all opacity-0 group-hover:opacity-100">Hapus</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {}
      {showBuatModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setShowBuatModal(false); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-md overflow-hidden p-8 shadow-2xl relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full pointer-events-none" />
            <h2 className="text-2xl font-bold text-white mb-6 text-glow">Buat Ujian Baru</h2>
            <form onSubmit={handleBuatUjian} className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Judul Ujian</label>
                <input type="text" required placeholder="Contoh: UTS Matematika 9A"
                  value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Instruksi</label>
                <textarea placeholder="Petunjuk pengerjaan..." rows={3}
                  value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all resize-none" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-3 font-semibold">Format File</label>
                <div className="flex gap-2 flex-wrap">
                  {FORMAT_OPTIONS.map(fmt => (
                    <button key={fmt} type="button" onClick={() => toggleFormat(fmt)}
                      className={`text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border transition-all ${
                        form.formatFile.includes(fmt) ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-white/5 text-white/30 border-white/10 hover:border-white/20'
                      }`}>
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-4 font-semibold flex justify-between">
                  Durasi <span>{form.durasi} Menit</span>
                </label>
                <input type="range" min={15} max={240} step={5} value={form.durasi} onChange={e => setForm({ ...form, durasi: Number(e.target.value) })}
                  className="w-full accent-blue-500" />
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowBuatModal(false)}
                  className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 text-xs px-4 py-3.5 rounded-xl font-semibold transition-all">Batal</button>
                <button type="submit" disabled={form.formatFile.length === 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold tracking-widest uppercase px-4 py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-40">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setShowExtendModal(null); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden p-8 shadow-2xl relative text-center">
            <h2 className="text-xl font-bold text-white mb-2 text-glow">Tambah Waktu</h2>
            <p className="text-sm text-cyan-400 font-bold mb-6">{showExtendModal.nama}</p>

            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 mb-6">
              <div className="text-4xl font-bold text-white mb-2">{tambahMenit}</div>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Menit Tambahan</p>
              <input type="range" min={5} max={60} step={5} value={tambahMenit} onChange={e => setTambahMenit(Number(e.target.value))}
                className="w-full mt-6 accent-emerald-500" />
            </div>

            <div className="text-[10px] text-white/30 font-medium mb-8">
              Deadline baru: <span className="text-white/60">{(() => {
                const d = new Date(new Date(showExtendModal.deadline).getTime() + tambahMenit * 60000);
                return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
              })()}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowExtendModal(null)}
                className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 text-xs px-4 py-3.5 rounded-xl font-semibold transition-all">Batal</button>
              <button onClick={handleExtend}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white text-xs font-bold tracking-widest uppercase px-4 py-3.5 rounded-xl shadow-lg transition-all">
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showBatchModal && selectedUjian && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowBatchModal(false); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-md overflow-hidden p-8 shadow-2xl relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />
            <h2 className="text-xl font-bold text-white mb-1 text-glow">Tambah Batch Sesi</h2>
            <p className="text-xs text-white/40 mb-6">Untuk ujian: <span className="text-cyan-400 font-semibold">{selectedUjian.judul}</span></p>
            <form onSubmit={handleBatchSubmit} className="space-y-5 relative">
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-3 font-semibold">Pilih Kelas</label>
                {kelasList.length === 0 ? (
                  <p className="text-xs text-white/30 italic">Belum ada data siswa. Import siswa di Dashboard terlebih dahulu.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {kelasList.map(k => (
                      <button key={k} type="button"
                        onClick={() => setBatchKelas(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])}
                        className={`text-xs font-bold px-3 py-2.5 rounded-xl border transition-all ${
                          batchKelas.includes(k)
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                            : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20 hover:text-white/70'
                        }`}>{k}</button>
                    ))}
                  </div>
                )}
                {batchKelas.length > 0 && (
                  <p className="text-[10px] text-cyan-400 mt-2 font-medium">{batchKelas.length} kelas dipilih: {batchKelas.join(', ')}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Deadline Ujian</label>
                <input required type="datetime-local" value={batchDeadline} onChange={e => setBatchDeadline(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBatchModal(false)}
                  className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 text-xs px-4 py-3.5 rounded-xl font-semibold transition-all">Batal</button>
                <button type="submit" disabled={isBatchLoading || batchKelas.length === 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold tracking-wider uppercase px-4 py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-40">
                  {isBatchLoading ? 'Generating...' : `Generate${batchKelas.length > 0 ? ` (${batchKelas.length} Kelas)` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
