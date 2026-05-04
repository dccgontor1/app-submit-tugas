import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Ujian, Sesi } from '../types';

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

  const [form, setForm] = useState({
    judul: '',
    deskripsi: '',
    formatFile: ['pdf'] as string[],
    durasi: 90,
  });

  const fetchUjian = async () => {
    const res = await fetch('http://localhost:5000/admin/ujian', {
      credentials: 'include',
    });
    if (res.status === 401) return navigate('/401');
    if (!res.ok) return;
    setUjianList(await res.json());
  };

  const fetchMonitor = useCallback(async (id: string) => {
    const res = await fetch(`http://localhost:5000/admin/ujian/${id}/monitor`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    setSesiList(await res.json());
  }, []);

  useEffect(() => { fetchUjian(); }, []);

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
    // ✅ Fix: ambil data terbaru dari response, bukan dari stale state
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
      headers: { 'Content-Type': 'application/json' }, // ✅ fix: credentials dipindah ke fetch options
      credentials: 'include',
      body: JSON.stringify({ token: showExtendModal.token, tambahMenit }),
    });
    if (!res.ok) return alert('Gagal extend waktu');
    setShowExtendModal(null);
    fetchMonitor(selectedUjian.id);
  };

  const handleHapusUjian = async (id: string, judul: string) => {
  if (!window.confirm(`Hapus ujian "${judul}"? Semua data sesi siswa dan tugas akan ikut terhapus permanen!`)) return;

  try {
    const res = await fetch(`http://localhost:5000/admin/ujian/${id}`, {
      method: 'DELETE',
      credentials: 'include', // Pastikan kredensial disertakan sesuai saran sebelumnya
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal menghapus');
    }

    alert('Ujian berhasil dihapus');
    setSelectedUjian(null); // Reset pilihan di UI
    fetchUjian(); // Refresh daftar ujian di sidebar
  } catch (error: any) {
    alert(error.message);
  }
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

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navbar */}
      <nav className="bg-[#0d0d14] border-b border-white/[0.06] sticky top-0 z-40 h-14 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <span className="font-mono text-sm font-bold text-white">
            <span className="text-indigo-400">DCC</span>_ADMIN
          </span>
          <button onClick={() => navigate('/dashboard')}
            className="font-mono text-[10px] tracking-[0.1em] text-white/30 hover:text-white/60 uppercase transition-colors">
            ← Dashboard
          </button>
        </div>
        <div className="flex items-center gap-3">
          {polling && (
            <span className="font-mono text-[9px] tracking-[0.1em] text-emerald-400/60 uppercase">
              Live
            </span>
          )}
          <button onClick={() => { logout(); navigate('/login'); }}
            className="border border-red-500/30 text-red-400/70 hover:border-red-500/70 hover:text-red-300 font-mono text-[10px] tracking-[0.1em] uppercase px-3.5 py-1.5 rounded-sm transition-all">
            Keluar
          </button>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Sidebar — daftar ujian */}
        <aside className="w-72 border-r border-white/[0.06] bg-[#0d0d14] flex flex-col shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
            <span className="font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase">Daftar Ujian</span>
            <button onClick={() => setShowBuatModal(true)}
              className="font-mono text-[10px] tracking-[0.08em] text-indigo-400 uppercase hover:text-indigo-300 transition-colors">
              + Buat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ujianList.length === 0 ? (
              <div className="p-6 text-center font-mono text-[10px] tracking-[0.1em] text-white/15 uppercase">
                Belum ada ujian
              </div>
            ) : ujianList.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelectUjian(u)}
                className={`w-full text-left px-4 py-4 border-b border-white/[0.04] transition-all ${
                  selectedUjian?.id === u.id
                    ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                    : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-sm font-medium text-white leading-tight">{u.judul}</span>
                  <span className={`font-mono text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5 rounded-[1px] border ml-2 shrink-0 ${statusColor[u.status]}`}>
                    {u.status === 'MENUNGGU' ? 'Tunggu' : u.status === 'BERLANGSUNG' ? 'Live' : 'Selesai'}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-white/25">
                  {u.durasi} menit · {u._count?.sesiAktif ?? 0} siswa
                </div>
                <div className="font-mono text-[9px] text-white/20 mt-1">
                  {u.formatFile.join(', ').toUpperCase()}
                </div>
                <div className="font-mono text-[9px] text-indigo-400/50 mb-1 tracking-wider uppercase">
                  ID: {u.id}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex-1 overflow-y-auto p-8">
          {!selectedUjian ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="font-mono text-[10px] tracking-[0.2em] text-white/15 uppercase mb-4">
                  Pilih ujian dari sidebar
                </p>
                <button onClick={() => setShowBuatModal(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[11px] tracking-[0.08em] uppercase px-5 py-2.5 rounded-sm transition-colors">
                  + Buat Ujian Baru
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header ujian */}
              <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase mb-1">
                    {selectedUjian.status === 'BERLANGSUNG' ? '● Live' : selectedUjian.status}
                  </p>
                  <h1 className="font-mono text-xl font-bold text-white mb-1">{selectedUjian.judul}</h1>
                  {selectedUjian.deskripsi && (
                    <p className="text-sm text-white/30">{selectedUjian.deskripsi}</p>
                  )}
                  <div className="flex gap-3 mt-3 flex-wrap">
                    <span className="font-mono text-[10px] text-white/30">
                      Durasi: {selectedUjian.durasi} menit
                    </span>
                    <span className="font-mono text-[10px] text-white/30">
                      Format: {selectedUjian.formatFile.join(', ').toUpperCase()}
                    </span>
                    <span className="font-mono text-[8px] text-indigo-400/40 uppercase tracking-widest">Ujian ID</span>
                    <span 
                      className="font-mono text-[10px] text-indigo-300/70 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-sm cursor-help"
                      title="Klik untuk menyalin ID"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedUjian.id);
                        alert("ID disalin!");
                      }}
                    >
                      {selectedUjian.id}
                    </span>
                  </div>
                </div>
                

                {selectedUjian.status === 'MENUNGGU' && (
                  <button onClick={handleStart}
                    className="bg-emerald-500/80 hover:bg-emerald-500 text-white font-mono text-[11px] tracking-[0.1em] uppercase px-6 py-3 rounded-sm transition-colors active:scale-[0.98]">
                    ▶ Mulai Ujian
                  </button>
                )}
                {selectedUjian.status === 'BERLANGSUNG' && (
                  <button onClick={() => fetchMonitor(selectedUjian.id)}
                    className="border border-emerald-500/30 text-emerald-400/70 font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2 rounded-sm hover:bg-emerald-500/10 transition-all">
                    Refresh
                  </button>
                )}
                {/* Tombol Hapus di samping judul atau di baris aksi */}
                <button 
                  onClick={() => handleHapusUjian(selectedUjian.id, selectedUjian.judul)}
                  className="border border-red-500/30 text-red-400/70 font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2 rounded-sm hover:bg-red-500/10 transition-all ml-2"
                >
                  Hapus Ujian
                </button>
              </div>

              {/* Stat bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05] border border-white/[0.05] rounded-sm overflow-hidden mb-6">
                {[
                  { label: 'Total Siswa', value: sesiList.length, color: 'text-white' },
                  { label: 'Belum Mulai', value: sesiList.filter(s => !s.startedAt).length, color: 'text-white/40' },
                  { label: 'Sedang Ujian', value: sesiList.filter(s => s.startedAt && !isExpired(s.deadline)).length, color: 'text-emerald-300' },
                  { label: 'Waktu Habis', value: sesiList.filter(s => s.startedAt && isExpired(s.deadline)).length, color: 'text-red-300' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#13131a] px-5 py-4">
                    <p className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase mb-1">{label}</p>
                    <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabel monitor siswa */}
              <div className="bg-[#13131a] border border-white/[0.07] rounded-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06]">
                  <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-white/50">
                    Monitor Siswa
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                        {['No', 'Nama', 'Kelas', 'Token', 'Deadline', 'Status', 'Aksi'].map((h, i) => (
                          <th key={h} className={`px-4 py-2.5 font-mono text-[9px] tracking-[0.15em] text-white/20 uppercase font-normal text-left ${i === 6 ? 'text-center' : ''}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sesiList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-10 text-center font-mono text-[11px] text-white/15 uppercase tracking-[0.1em]">
                            Belum ada siswa terdaftar
                          </td>
                        </tr>
                      ) : sesiList.map(sesi => {
                        const started = !!sesi.startedAt;
                        const expired = isExpired(sesi.deadline);
                        const statusLabel = !started ? 'Menunggu' : expired ? 'Habis' : 'Aktif';
                        const statusCls = !started
                          ? 'bg-white/[0.06] text-white/30 border-white/10'
                          : expired
                          ? 'bg-red-500/10 text-red-300/70 border-red-500/15'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';

                        return (
                          <tr key={sesi.token} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-mono text-[11px] text-white/30">{sesi.noAbsen}</td>
                            <td className="px-4 py-3 text-sm font-medium text-white">{sesi.nama}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-white/40">{sesi.kelas}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-[11px] tracking-[0.2em] text-amber-300/70 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-[1px] select-all">
                                {sesi.token}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-white/30 whitespace-nowrap">
                              {sesi.deadline ? formatTime(sesi.deadline) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-[1px] border ${statusCls}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {selectedUjian.status === 'BERLANGSUNG' && (
                                <button
                                  onClick={() => { setShowExtendModal(sesi); setTambahMenit(10); }}
                                  className="border border-transparent hover:border-amber-500/40 text-amber-400/50 hover:text-amber-300 hover:bg-amber-500/[0.06] font-mono text-[9px] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm transition-all whitespace-nowrap"
                                >
                                  + Waktu
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal Buat Ujian */}
      {showBuatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowBuatModal(false); }}>
          <div className="bg-[#13131a] border border-white/10 rounded-sm w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center">
              <span className="font-mono text-xs tracking-[0.1em] uppercase text-white/70">Buat Ujian Baru</span>
              <button onClick={() => setShowBuatModal(false)} className="text-white/30 hover:text-white/70 text-base leading-none">✕</button>
            </div>
            <form onSubmit={handleBuatUjian}>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">Judul Ujian</label>
                  <input type="text" required placeholder="Contoh: UTS Matematika Kelas 9"
                    value={form.judul}
                    onChange={e => setForm({ ...form, judul: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm px-4 py-3 text-sm text-[#e8e6e0] placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">Deskripsi / Instruksi</label>
                  <textarea placeholder="Kerjakan soal berikut..." rows={3}
                    value={form.deskripsi}
                    onChange={e => setForm({ ...form, deskripsi: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-sm px-4 py-3 text-sm text-[#e8e6e0] placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-3">Format File Diterima</label>
                  <div className="flex gap-2 flex-wrap">
                    {FORMAT_OPTIONS.map(fmt => (
                      <button key={fmt} type="button"
                        onClick={() => toggleFormat(fmt)}
                        className={`font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-1.5 rounded-sm border transition-all ${
                          form.formatFile.includes(fmt)
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-white/[0.03] text-white/30 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                  {form.formatFile.length === 0 && (
                    <p className="text-[11px] text-red-300/70 mt-2">Pilih minimal satu format</p>
                  )}
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">
                    Durasi — <span className="text-white/60">{form.durasi} menit</span>
                  </label>
                  <input type="range" min={15} max={240} step={5}
                    value={form.durasi}
                    onChange={e => setForm({ ...form, durasi: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-white/20 mt-1">
                    <span>15 mnt</span><span>4 jam</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2.5 justify-end">
                <button type="button" onClick={() => setShowBuatModal(false)}
                  className="border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-all">
                  Batal
                </button>
                <button type="submit" disabled={form.formatFile.length === 0}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-colors">
                  Simpan Ujian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Extend Waktu */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowExtendModal(null); }}>
          <div className="bg-[#13131a] border border-white/10 rounded-sm w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center">
              <span className="font-mono text-xs tracking-[0.1em] uppercase text-white/70">Tambah Waktu</span>
              <button onClick={() => setShowExtendModal(null)} className="text-white/30 hover:text-white/70 text-base leading-none">✕</button>
            </div>
            <form onSubmit={handleExtend}>
              <div className="p-6 space-y-4">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-sm px-4 py-3">
                  <p className="text-sm font-medium text-white">{showExtendModal.nama}</p>
                  <p className="font-mono text-[10px] text-white/30 mt-0.5">
                    {showExtendModal.kelas} · No. {showExtendModal.noAbsen}
                  </p>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">
                    Tambah Waktu — <span className="text-amber-300">{tambahMenit} menit</span>
                  </label>
                  <input type="range" min={5} max={60} step={5}
                    value={tambahMenit}
                    onChange={e => setTambahMenit(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-white/20 mt-1">
                    <span>5 mnt</span><span>60 mnt</span>
                  </div>
                </div>
                <div className="font-mono text-[11px] text-white/30 text-center">
                  Deadline baru: {(() => {
                    const d = new Date(new Date(showExtendModal.deadline).getTime() + tambahMenit * 60000);
                    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
                  })()}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2.5 justify-end">
                <button type="button" onClick={() => setShowExtendModal(null)}
                  className="border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-all">
                  Batal
                </button>
                <button type="submit"
                  className="bg-amber-500/80 hover:bg-amber-500 text-white font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-colors">
                  Tambahkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}