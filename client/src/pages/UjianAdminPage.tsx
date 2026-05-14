import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../utils/api';
import type { Ujian, Sesi } from '../types';
import {
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  LogOut,
  RefreshCw,
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Zap,
  Printer,
  ChevronDown,
  ChevronUp,
  Square
} from 'lucide-react';

const FORMAT_OPTIONS = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'pptx', 'ppt'];

export default function UjianAdminPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [ujianList, setUjianList] = useState<Ujian[]>([]);
  const [selectedUjian, setSelectedUjian] = useState<Ujian | null>(null);
  const [sesiList, setSesiList] = useState<Sesi[]>([]);
  const [tugasList, setTugasList] = useState<any[]>([]);
  const [showBuatModal, setShowBuatModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState<Sesi | null>(null);
  const [tambahMenit, setTambahMenit] = useState(10);
  const [polling, setPolling] = useState(false);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [kelasList, setKelasList] = useState<string[]>([]);
  const [batchKelas, setBatchKelas] = useState<string[]>([]);
  const [batchDeadline, setBatchDeadline] = useState('');
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<Sesi[] | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  const toggleBatch = (key: string) => setExpandedBatches(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const [form, setForm] = useState({
    judul: '',
    deskripsi: '',
    formatFile: ['pdf', 'pptx', 'ppt'] as string[],
    durasi: 90,
    kriteria: [{ label: '', skor: 0 }] as { label: string; skor: number }[],
  });

  const fetchUjian = async () => {
    const res = await fetch(`${API_BASE_URL}/admin/ujian`, { credentials: 'include' });
    if (res.status === 401) return navigate('/401');
    if (!res.ok) return;
    setUjianList(await res.json());
  };

  const fetchMonitor = useCallback(async (id: string) => {
    const [sRes, tRes] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/ujian/${id}/monitor`, { credentials: 'include' }),
      fetch(`${API_BASE_URL}/admin/tugas?ujianId=${id}`, { credentials: 'include' })
    ]);
    if (sRes.ok) setSesiList(await sRes.json());
    if (tRes.ok) setTugasList(await tRes.json());
  }, []);

  const fetchKelas = async () => {
    const res = await fetch(`${API_BASE_URL}/admin/siswa/kelas`, { credentials: 'include' });
    if (res.ok) setKelasList(await res.json());
  };

  useEffect(() => { fetchUjian(); fetchKelas(); }, []);

  useEffect(() => {
    if (!selectedUjian) return;
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
    const cleanForm = {
      ...form,
      kriteria: form.kriteria.filter(k => k.label.trim() !== '')
    };
    const res = await fetch(`${API_BASE_URL}/admin/ujian`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(cleanForm),
    });
    if (!res.ok) return alert('Gagal membuat ujian');
    setShowBuatModal(false);
    setForm({ judul: '', deskripsi: '', formatFile: ['pdf'], durasi: 90, kriteria: [{ label: '', skor: 0 }] });
    fetchUjian();
  };

  const handleStartBatch = async (tokens: string[], batchLabel: string) => {
    if (!selectedUjian) return;
    if (!window.confirm(`Mulai ${batchLabel} sekarang?\nTimer akan berjalan untuk ${tokens.length} siswa dalam batch ini.`)) return;
    const res = await fetch(`${API_BASE_URL}/admin/ujian/${selectedUjian.id}/start-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tokens }),
    });
    if (!res.ok) return alert('Gagal memulai batch');
    const freshRes = await fetch(`${API_BASE_URL}/admin/ujian`, { credentials: 'include' });
    if (freshRes.ok) {
      const freshList: Ujian[] = await freshRes.json();
      setUjianList(freshList);
      const updated = freshList.find(u => u.id === selectedUjian.id);
      if (updated) setSelectedUjian(updated);
    }
    fetchMonitor(selectedUjian.id);
  };

  const handleEndBatch = async (tokens: string[], batchLabel: string) => {
    if (!selectedUjian) return;
    if (!window.confirm(`Akhiri ${batchLabel} sekarang? Semua siswa dalam batch ini akan langsung selesai.`)) return;
    const res = await fetch(`${API_BASE_URL}/admin/ujian/${selectedUjian.id}/end-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tokens }),
    });
    if (!res.ok) return alert('Gagal mengakhiri batch');
    fetchMonitor(selectedUjian.id);
  };

  const handleExtend = async (e: FormEvent) => {
    e.preventDefault();
    if (!showExtendModal || !selectedUjian) return;
    const res = await fetch(`${API_BASE_URL}/admin/ujian/${selectedUjian.id}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: showExtendModal.token, tambahMenit }),
    });
    if (!res.ok) return alert('Gagal extend waktu');
    setShowExtendModal(null);
    fetchMonitor(selectedUjian.id);
  };

  const handleResetSesi = async (token: string, nama: string) => {
    if (!window.confirm(`Reset sesi ${nama}? Siswa bisa login ulang.`)) return;
    const res = await fetch(`${API_BASE_URL}/admin/sesi/${token}/reset`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return alert('Gagal reset sesi');
    fetchMonitor(selectedUjian!.id);
  };

  const handleRemedial = async (stambuk?: string, noAbsen?: number, kelas?: string, nama?: string) => {
    const min = prompt(`Remedial untuk ${nama || 'siswa'}?\nMasukkan durasi remedial (menit):`, '60');
    if (!min) return;
    const deadline = new Date(Date.now() + Number(min) * 60000).toISOString();
    
    const res = await fetch(`${API_BASE_URL}/admin/ujian/${selectedUjian!.id}/remedial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stambuk, noAbsen, kelas, deadline }),
    });
    if (!res.ok) return alert('Gagal memproses remedial');
    alert('Siswa berhasil diremedialkan.');
    fetchMonitor(selectedUjian!.id);
  };

  const handleHapusUjian = async (id: string, judul: string) => {
    if (!window.confirm(`Hapus ujian "${judul}"? Semua sesi akan terhapus dan muncul di riwayat.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ujian/${id}`, { method: 'DELETE', credentials: 'include' });
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
      const res = await fetch(`${API_BASE_URL}/admin/ujian/${selectedUjian.id}/generate-sesi-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kelasList: batchKelas, deadline: batchDeadline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal');
      // Fetch fresh sesi list then show preview
      const monRes = await fetch(`${API_BASE_URL}/admin/ujian/${selectedUjian.id}/monitor`, { credentials: 'include' });
      const allSesi: Sesi[] = monRes.ok ? await monRes.json() : [];
      const deadlineTs = new Date(batchDeadline).getTime().toString();
      const newSesi = allSesi.filter(s => s.deadline && new Date(s.deadline).getTime().toString() === deadlineTs);
      setSesiList(allSesi);
      setBatchResult(newSesi.length > 0 ? newSesi : allSesi.slice(-data.total));
      setExpandedBatches(prev => new Set([...prev, deadlineTs]));
      fetchUjian();
    } catch (err: any) { alert(err.message); }
    finally { setIsBatchLoading(false); }
  };

  const printBatch = (batchSesi: Sesi[], ujianJudul: string) => {
    const w = window.open('', '_blank', 'width=960,height=720');
    if (!w) { alert('Izinkan popup di browser untuk mencetak.'); return; }
    const deadlineStr = batchSesi[0]?.deadline
      ? new Date(batchSesi[0].deadline).toLocaleString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';
    const cards = batchSesi.map(s => `
      <div class="card">
        <div class="card-top">
          <span class="label-small">KARTU UJIAN SANTRI</span>
          <span class="ujian-name">${ujianJudul}</span>
        </div>
        <div class="info">
          <div class="info-row"><span>Nama</span><span class="info-val"><b>${s.nama}</b></span></div>
          <div class="info-row"><span>Stambuk</span><span class="info-val">${s.stambuk || '—'}</span></div>
          <div class="info-row"><span>Kelas</span><span class="info-val">${s.kelas}</span></div>
          <div class="info-row"><span>No. Absen</span><span class="info-val">${s.noAbsen}</span></div>
          <div class="info-row"><span>Deadline</span><span class="info-val">${deadlineStr}</span></div>
        </div>
        <div class="token-box">
          <div class="token-label">KODE LOGIN UJIAN</div>
          <div class="token">${s.token}</div>
        </div>
      </div>`).join('');
    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Kartu — ${ujianJudul}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;background:#eee;padding:16px}
      .controls{text-align:center;margin-bottom:20px}
      .controls button{background:#4f46e5;color:#fff;border:none;padding:10px 28px;border-radius:4px;cursor:pointer;font:bold 13px monospace;letter-spacing:.1em;text-transform:uppercase;margin:0 6px}
      .controls button.sec{background:#555}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
      .card{background:#fff;border:1.5px solid #333;padding:12px;break-inside:avoid}
      .card-top{border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-end}
      .label-small{font-size:8px;letter-spacing:.2em;color:#888;text-transform:uppercase}
      .ujian-name{font-size:11px;font-weight:bold;color:#222;max-width:60%;text-align:right}
      .info{margin-bottom:10px}
      .info-row{display:flex;justify-content:space-between;font-size:10.5px;padding:2px 0;border-bottom:1px dotted #eee}
      .info-row span:first-child{color:#666;width:65px;flex-shrink:0}
      .info-val{text-align:right}
      .token-box{border:2px dashed #4f46e5;text-align:center;padding:10px 6px;background:#f5f5ff}
      .token-label{font-size:8px;letter-spacing:.25em;color:#4f46e5;text-transform:uppercase;margin-bottom:4px}
      .token{font-size:30px;font-weight:bold;letter-spacing:.45em;color:#1e1b4b}
      @media print{body{background:#fff;padding:4mm}.controls{display:none}}
      @page{size:A4;margin:1cm}
    </style></head><body>
      <div class="controls">
        <button onclick="window.print()">🖨 Cetak (${batchSesi.length} siswa)</button>
        <button class="sec" onclick="window.close()">Tutup</button>
      </div>
      <div class="grid">${cards}</div>
    </body></html>`);
    w.document.close();
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
      const res = await fetch(`${API_BASE_URL}/admin/sesi/${token}`, { method: 'DELETE', credentials: 'include' });
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
      await Promise.all(tokens.map(t => fetch(`${API_BASE_URL}/admin/sesi/${t}`, { method: 'DELETE', credentials: 'include' })));
      if (selectedUjian) fetchMonitor(selectedUjian.id);
    } catch (e) {
      alert('Terjadi kesalahan saat menghapus batch');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050a]">
      {orbs}

      { }
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

      { }
      <div className="border-b border-white/[0.05] bg-black/20 backdrop-blur-sm px-8 py-4 flex items-center gap-4 overflow-x-auto relative z-10">
        <button onClick={() => setShowBuatModal(true)}
          className="shrink-0 flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all">
          <Plus className="w-4 h-4" />
          Tambah Materi
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
              className={`shrink-0 flex flex-col items-start px-4 py-3 rounded-xl border transition-all text-left min-w-[160px] ${selectedUjian?.id === u.id
                ? 'bg-blue-600/20 border-blue-500/30'
                : 'bg-black/40 border-white/5 hover:bg-white/5'
                }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white truncate max-w-[120px]">{u.judul}</span>
              </div>
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
            { }
            <div className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-all duration-700" />

              <div className="flex justify-between items-start gap-8 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-white/30 text-sm font-mono">{selectedUjian.id}</span>
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">{selectedUjian.judul}</h1>
                  <p className="text-white/50">{selectedUjian.deskripsi}</p>
                </div>

                <div className="flex gap-3">
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

            <div className="space-y-3">
              {sortedBatches.map((batchKey, i) => {
                const batchSiswa = groupedBatches[batchKey];
                const kelasDalamBatch = Array.from(new Set(batchSiswa.map(s => s.kelas))).sort();
                const tugasInBatch = tugasList.filter(t => 
                  kelasDalamBatch.includes(t.kelas) && 
                  (batchSiswa.some(s => s.stambuk === t.stambuk) || (!t.stambuk && batchSiswa.some(s => s.noAbsen === t.noAbsen)))
                );
                const batchTokens = batchSiswa.map(s => s.token);
                const isBatchStarted = batchSiswa.some(s => !!s.startedAt);
                const isBatchActive = batchSiswa.some(s => !!s.startedAt && !isExpired(s.deadline));
                const batchLabel = `Batch ${i + 1} (${kelasDalamBatch.join(', ')})`;
                const isOpen = expandedBatches.has(batchKey);
                return (
                  <div key={batchKey} className="glass-panel rounded-2xl overflow-hidden border border-white/10 group/batch">
                    <div
                      className="px-5 py-3.5 bg-white/[0.02] flex items-center justify-between cursor-pointer select-none hover:bg-white/[0.04] transition-colors"
                      onClick={() => toggleBatch(batchKey)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-lg border text-[9px] uppercase font-bold ${
                          !isBatchStarted 
                            ? 'bg-white/5 text-white/40 border-white/10' 
                            : isBatchActive 
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' 
                              : 'bg-white/5 text-white/20 border-white/10'
                        }`}>
                          {!isBatchStarted ? 'Tunggu' : isBatchActive ? 'Live' : 'Selesai'}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center"><span className="text-blue-300 font-bold text-[11px]">B{i + 1}</span></div>
                        <span className="text-sm font-bold text-white">Batch {i + 1} <span className="text-[10px] text-blue-300 ml-1 font-normal">({kelasDalamBatch.join(', ')})</span></span>
                        <span className="text-[10px] text-white/30">— {batchSiswa.length} siswa</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold" onClick={e => e.stopPropagation()}>
                        <span className="text-emerald-400">Aktif: {batchSiswa.filter(s => s.startedAt && !isExpired(s.deadline)).length}</span>
                        <span className="text-red-400">Habis: {batchSiswa.filter(s => isExpired(s.deadline)).length}</span>
                        {batchSiswa[0]?.deadline && <span className="font-mono text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg">⏱ {formatTime(batchSiswa[0].deadline)}</span>}

                        {!isBatchStarted ? (
                          <button onClick={() => handleStartBatch(batchTokens, batchLabel)} className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all">
                            <Zap className="w-3 h-3" /> Mulai
                          </button>
                        ) : isBatchActive ? (
                          <button onClick={() => handleEndBatch(batchTokens, batchLabel)} className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all">
                            <Square className="w-3 h-3" /> Akhiri
                          </button>
                        ) : (
                          <span className="text-white/20 bg-white/5 border border-white/10 px-2 py-1 rounded text-[10px] uppercase">Selesai</span>
                        )}

                        <button onClick={() => printBatch(batchSiswa, selectedUjian.judul)} className="flex items-center gap-1.5 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg transition-all">
                          <Printer className="w-3 h-3" /> Cetak
                        </button>
                        <button onClick={() => handleDeleteBatch(batchKey)} className="text-[10px] font-bold text-red-500/0 group-hover/batch:text-red-400 bg-red-500/0 group-hover/batch:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all">Hapus</button>
                        <div className="text-white/30 ml-1">{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="bg-black/20">
                        <div className="grid grid-cols-4 gap-px bg-white/5 border-b border-white/5">
                          {[
                            { label: 'Total Siswa', val: batchSiswa.length + tugasInBatch.length, color: 'text-white' },
                            { label: 'Hadir (Login)', val: batchSiswa.filter(s => !!s.loggedInAt).length + tugasInBatch.length, color: 'text-emerald-400' },
                            { label: 'Belum Login', val: batchSiswa.filter(s => !s.loggedInAt).length, color: 'text-red-400' },
                            { label: 'Sudah Submit', val: tugasInBatch.length, color: 'text-blue-400' },
                          ].map((s, idx) => (
                            <div key={idx} className="bg-white/[0.02] p-4 text-center">
                              <p className="text-[9px] uppercase tracking-widest text-white/20 mb-1 font-bold">{s.label}</p>
                              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                            </div>
                          ))}
                        </div>

                        <table className="w-full text-left">
                          <thead><tr className="border-b border-white/5 bg-white/[0.01]">
                            {['No', 'Nama', 'Kelas', 'Token', 'Hadir', 'Status', 'Aksi'].map((h, idx) => <th key={h} className={`px-5 py-3 text-[10px] text-white/20 uppercase tracking-widest font-bold ${idx === 6 ? 'text-center' : ''}`}>{h}</th>)}
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
                                <td className="px-5 py-3">
                                  {sesi.loggedInAt ? (
                                    <span className="text-[9px] font-bold text-emerald-400/70 flex items-center gap-1.5 bg-emerald-500/5 px-2 py-1 rounded-lg border border-emerald-500/10 w-fit">
                                      <CheckCircle className="w-3 h-3" /> Hadir
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-white/10 flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg border border-white/5 w-fit">
                                      <Clock className="w-3 h-3" /> Belum
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3"><span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg border ${cls}`}>{!on ? 'Tunggu' : exp ? 'Habis' : 'Aktif'}</span></td>
                                <td className="px-5 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleResetSesi(sesi.token, sesi.nama)} className="text-[10px] font-bold uppercase px-3 py-1.5 bg-white/5 hover:bg-amber-500/20 text-white/50 hover:text-amber-400 border border-white/10 hover:border-amber-500/30 rounded-lg transition-all" title="Reset Login">Reset</button>
                                    <button onClick={() => { setShowExtendModal(sesi); setTambahMenit(10); }} className="text-[10px] font-bold uppercase px-3 py-1.5 bg-white/5 hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-all">+Waktu</button>
                                    <button onClick={() => handleDeleteSesi(sesi.token, sesi.nama)} className="text-[10px] font-bold uppercase px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 border border-white/10 hover:border-red-500/30 rounded-lg transition-all opacity-0 group-hover:opacity-100">Hapus</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {tugasInBatch.map(tugas => (
                            <tr key={tugas.id} className="border-b border-white/[0.02] last:border-0 bg-white/[0.01] hover:bg-white/[0.03] group grayscale opacity-60">
                              <td className="px-5 py-3 text-xs text-white/20 font-mono">{tugas.noAbsen}</td>
                              <td className="px-5 py-3"><div className="text-sm font-bold text-white/60">{tugas.nama}</div><div className="text-[10px] text-white/20">{tugas.stambuk || '-'}</div></td>
                              <td className="px-5 py-3"><span className="text-xs text-white/40">{tugas.kelas}</span></td>
                              <td className="px-5 py-3 text-white/10 text-xs italic">— Submitted —</td>
                              <td className="px-5 py-3">
                                <span className="text-[9px] font-bold text-blue-400/70 flex items-center gap-1.5 bg-blue-500/5 px-2 py-1 rounded-lg border border-blue-500/10 w-fit">
                                  <CheckCircle className="w-3 h-3" /> Selesai
                                </span>
                              </td>
                              <td className="px-5 py-3"><span className="text-[9px] font-bold uppercase px-2 py-1 rounded-lg border border-white/10 text-white/30">Submitted</span></td>
                              <td className="px-5 py-3 text-center">
                                <button onClick={() => handleRemedial(tugas.stambuk, tugas.noAbsen, tugas.kelas, tugas.nama)} 
                                  className="text-[10px] font-bold uppercase px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 rounded-xl transition-all">
                                  Remedial
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                );
              })}
            </div>
          </div>
        )}
      </main>


      {showBuatModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setShowBuatModal(false); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full pointer-events-none" />
            <div className="p-6 sm:p-8 overflow-y-auto">
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
                        className={`text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border transition-all ${form.formatFile.includes(fmt) ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-white/5 text-white/30 border-white/10 hover:border-white/20'
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

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] tracking-wider text-white/40 uppercase font-semibold">Kriteria Penilaian</label>
                    <button type="button" onClick={() => setForm(f => ({ ...f, kriteria: [...f.kriteria, { label: '', skor: 0 }] }))}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Tambah
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.kriteria.map((k, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="text" placeholder="Nama Kriteria (Contoh: Kerapihan)" value={k.label} required
                          onChange={e => {
                            const nk = [...form.kriteria];
                            nk[idx].label = e.target.value;
                            setForm({ ...form, kriteria: nk });
                          }}
                          className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500/50" />
                        <input type="number" placeholder="Skor" value={k.skor} required
                          onChange={e => {
                            const nk = [...form.kriteria];
                            nk[idx].skor = Number(e.target.value);
                            setForm({ ...form, kriteria: nk });
                          }}
                          className="w-16 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white text-center outline-none focus:border-blue-500/50" />
                        {form.kriteria.length > 1 && (
                          <button type="button" onClick={() => setForm(f => ({ ...f, kriteria: f.kriteria.filter((_, i) => i !== idx) }))}
                            className="p-2 text-white/20 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="text-[9px] text-white/20 italic mt-1 font-medium">Total Skor: {form.kriteria.reduce((a, b) => a + b.skor, 0)}</div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <button type="button" onClick={() => setShowBuatModal(false)}
                    className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 text-xs px-4 py-3.5 rounded-xl font-semibold transition-all order-2 sm:order-1">Batal</button>
                  <button type="submit" disabled={form.formatFile.length === 0}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold tracking-widest uppercase px-4 py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-40 order-1 sm:order-2">
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      { }
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setShowExtendModal(null); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 overflow-y-auto text-center">
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

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => setShowExtendModal(null)}
                  className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 text-xs px-4 py-3.5 rounded-xl font-semibold transition-all order-2 sm:order-1">Batal</button>
                <button onClick={handleExtend}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white text-xs font-bold tracking-widest uppercase px-4 py-3.5 rounded-xl shadow-lg transition-all order-1 sm:order-2">
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && selectedUjian && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) { setShowBatchModal(false); setBatchResult(null); } }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />

            {batchResult ? (
              /* ── Preview hasil generate ── */
              <div className="flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-400" /> Batch Berhasil Dibuat</h2>
                    <p className="text-xs text-white/40 mt-0.5">{batchResult.length} sesi token untuk {selectedUjian.judul}</p>
                  </div>
                  <button onClick={() => printBatch(batchResult, selectedUjian.judul)} className="flex items-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-bold uppercase px-4 py-2.5 rounded-xl transition-all">
                    <Printer className="w-4 h-4" /> Cetak Kartu
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left">
                    <thead><tr className="bg-white/[0.02] border-b border-white/10">
                      {['No', 'Nama', 'Kelas', 'Token'].map(h => <th key={h} className="px-5 py-3 text-[10px] text-white/30 uppercase tracking-widest font-bold">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {batchResult.map(s => (
                        <tr key={s.token} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]">
                          <td className="px-5 py-3 text-xs text-white/30 font-mono">{s.noAbsen}</td>
                          <td className="px-5 py-3">
                            <div className="text-sm font-bold text-white">{s.nama}</div>
                            <div className="text-[10px] text-white/20">{s.stambuk || '-'}</div>
                          </td>
                          <td className="px-5 py-3 text-xs text-white/50">{s.kelas}</td>
                          <td className="px-5 py-3"><span className="font-mono text-sm font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-lg tracking-widest">{s.token}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-5 border-t border-white/10 flex justify-end gap-3 shrink-0">
                  <button onClick={() => { setShowBatchModal(false); setBatchResult(null); setBatchKelas([]); setBatchDeadline(''); }} className="border border-white/10 hover:bg-white/5 text-white/60 text-xs px-5 py-3 rounded-xl font-semibold transition-all">Tutup</button>
                </div>
              </div>
            ) : (
              /* ── Form generate ── */
              <div className="p-6 sm:p-8 overflow-y-auto">
                <h2 className="text-xl font-bold text-white mb-1 text-glow">Tambah Batch Sesi</h2>
                <p className="text-xs text-white/40 mb-6">Untuk ujian: <span className="text-cyan-400 font-semibold">{selectedUjian.judul}</span></p>
                <form onSubmit={handleBatchSubmit} className="space-y-6 relative">
                  <div>
                    <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-3 font-semibold">Pilih Kelas</label>
                    {kelasList.length === 0 ? (
                      <p className="text-xs text-white/30 italic">Belum ada data siswa. Import siswa di Dashboard terlebih dahulu.</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {kelasList.map(k => (
                            <button key={k} type="button"
                              onClick={() => setBatchKelas(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])}
                              className={`text-xs font-bold px-3 py-2.5 rounded-xl border transition-all ${batchKelas.includes(k)
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20 hover:text-white/70'
                                }`}>{k}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {batchKelas.length > 0 && (
                      <p className="text-[10px] text-cyan-400 mt-3 font-medium flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" />
                        {batchKelas.length} kelas dipilih: {batchKelas.join(', ')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Deadline Ujian</label>
                    <input required type="datetime-local" value={batchDeadline} onChange={e => setBatchDeadline(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button type="button" onClick={() => setShowBatchModal(false)} className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 text-xs px-4 py-3.5 rounded-xl font-semibold transition-all order-2 sm:order-1">Batal</button>
                    <button type="submit" disabled={isBatchLoading || batchKelas.length === 0} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold tracking-wider uppercase px-4 py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-40 order-1 sm:order-2">
                      {isBatchLoading ? 'Generating...' : `Generate${batchKelas.length > 0 ? ` (${batchKelas.length} kelas)` : ''}`}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
