import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ImportSiswaModal from '../components/ImportSiswaModal';
import GenerateSesiModal from '../components/GenerateSesiModal';
import { API_BASE_URL } from '../utils/api';
import type { Akun, Sesi, Siswa, Tugas, RiwayatUjian } from '../types';
import {
  X,
  FileUp,
  Settings,
  Users,
  LogOut
} from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'akun' | 'siswa' | 'sesi' | 'hasil'>('akun');

  const [akunList, setAkunList] = useState<Akun[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newAkun, setNewAkun] = useState({ nama: '', username: '', password: '', role: 'GURU' });
  const [selectedAkun, setSelectedAkun] = useState<Set<number>>(new Set());

  const [sesiList, setSesiList] = useState<Sesi[]>([]);
  const [isLoadingSesi, setIsLoadingSesi] = useState(false);
  const [selectedSesi, setSelectedSesi] = useState<Set<string>>(new Set());

  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const [editingSesi, setEditingSesi] = useState<Sesi | null>(null);
  const [editSesiForm, setEditSesiForm] = useState({ token: '', nama: '', kelas: '', noAbsen: '', deadline: '' });
  const [editSesiError, setEditSesiError] = useState('');
  const [isSavingSesi, setIsSavingSesi] = useState(false);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<any[]>([]);
  const [csvPreviewFile, setCsvPreviewFile] = useState<File | null>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  const [hasilSubTab, setHasilSubTab] = useState<'hasil' | 'riwayat'>('hasil');
  const [ujianAllList, setUjianAllList] = useState<{ id: string; judul: string }[]>([]);
  const [selectedUjianId, setSelectedUjianId] = useState('');
  const [hasilData, setHasilData] = useState<Tugas[]>([]);
  const [isLoadingHasil, setIsLoadingHasil] = useState(false);
  const [riwayatData, setRiwayatData] = useState<RiwayatUjian[]>([]);
  const [isLoadingRiwayat, setIsLoadingRiwayat] = useState(false);

  const fetchAkun = async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/akun`, { credentials: 'include' });
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
      const res = await fetch(`${API_BASE_URL}/admin/sesi`, { credentials: 'include' });
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

  const fetchSiswa = async () => {
    if (!user) return;
    setIsLoadingSiswa(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/siswa`, { credentials: 'include' });
      if (res.status === 401) return navigate('/401');
      if (res.status === 403) return navigate('/403');
      if (!res.ok) throw new Error();
      setSiswaList(await res.json());
    } catch {
      setSiswaList([]);
    } finally {
      setIsLoadingSiswa(false);
    }
  };

  const handleCreateAkun = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/akun`, {
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

  const handleBulkDeleteAkun = async () => {
    if (selectedAkun.size === 0) return;
    if (!window.confirm(`Hapus ${selectedAkun.size} akun sekaligus?`)) return;

    const results = await Promise.all(
      [...selectedAkun].map(async id => {
        const res = await fetch(`${API_BASE_URL}/admin/akun/${id}`, { method: 'DELETE', credentials: 'include' });
        return { id, ok: res.ok };
      })
    );
    const successIds = new Set(results.filter(r => r.ok).map(r => r.id));
    if (results.some(r => !r.ok)) alert('Beberapa akun gagal dihapus');
    setAkunList(prev => prev.filter(a => !successIds.has(a.id)));
    setSelectedAkun(new Set());
  };

  const handleBulkDeleteSesi = async () => {
    if (selectedSesi.size === 0) return;
    if (!window.confirm(`Hapus ${selectedSesi.size} sesi sekaligus?`)) return;

    const results = await Promise.all(
      [...selectedSesi].map(async token => {
        const res = await fetch(`${API_BASE_URL}/admin/sesi/${token}`, { method: 'DELETE', credentials: 'include' });
        return { token, ok: res.ok };
      })
    );
    const successTokens = new Set(results.filter(r => r.ok).map(r => r.token));
    if (results.some(r => !r.ok)) alert('Beberapa sesi gagal dihapus');
    setSesiList(prev => prev.filter(s => !successTokens.has(s.token)));
    setSelectedSesi(new Set());
  };

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
      const res = await fetch(`${API_BASE_URL}/admin/generate`, {
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

  const handleOpenEditSesi = (sesi: Sesi) => {
    setEditingSesi(sesi);

    const deadlineLocal = sesi.deadline
      ? new Date(sesi.deadline).toISOString().slice(0, 16)
      : '';
    setEditSesiForm({
      token: sesi.token,
      nama: sesi.nama,
      kelas: sesi.kelas,
      noAbsen: String(sesi.noAbsen),
      deadline: deadlineLocal,
    });
    setEditSesiError('');
  };

  const handleSaveEditSesi = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSesi) return;
    setEditSesiError('');

    const noAbsenNum = parseInt(editSesiForm.noAbsen);
    if (isNaN(noAbsenNum) || noAbsenNum <= 0) {
      setEditSesiError('No. Absen harus berupa angka positif');
      return;
    }

    const tokenBaru = editSesiForm.token.trim().toUpperCase();
    if (!tokenBaru) { setEditSesiError('Token tidak boleh kosong'); return; }
    if (!editSesiForm.nama.trim()) { setEditSesiError('Nama tidak boleh kosong'); return; }
    if (!editSesiForm.kelas.trim()) { setEditSesiError('Kelas tidak boleh kosong'); return; }
    if (!editSesiForm.deadline) { setEditSesiError('Deadline harus diisi'); return; }

    setIsSavingSesi(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/sesi/${editingSesi.token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          newToken: tokenBaru !== editingSesi.token ? tokenBaru : undefined,
          nama: editSesiForm.nama.trim(),
          kelas: editSesiForm.kelas.trim(),
          noAbsen: noAbsenNum,
          deadline: new Date(editSesiForm.deadline).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan');

      const finalToken = tokenBaru !== editingSesi.token ? tokenBaru : editingSesi.token;
      setSesiList(prev => prev.map(s =>
        s.token === editingSesi.token
          ? { ...s, token: finalToken, nama: editSesiForm.nama.trim(), kelas: editSesiForm.kelas.trim(), noAbsen: noAbsenNum, deadline: new Date(editSesiForm.deadline).toISOString() }
          : s
      ));
      setEditingSesi(null);
    } catch (err: any) {
      setEditSesiError(err.message);
    } finally {
      setIsSavingSesi(false);
    }
  };

  useEffect(() => { fetchAkun(); fetchSesi(); fetchSiswa(); fetchUjianAll(); fetchRiwayat(); }, []);

  const fetchUjianAll = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ujian?includeDeleted=true`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUjianAllList(data.map((u: any) => ({ id: u.id, judul: u.judul })));
      }
    } catch { }
  };

  const fetchHasil = async (ujianId: string) => {
    if (!ujianId) return;
    setIsLoadingHasil(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ujian/${ujianId}/hasil`, { credentials: 'include' });
      if (res.ok) setHasilData(await res.json());
    } catch { } finally { setIsLoadingHasil(false); }
  };

  const fetchRiwayat = async () => {
    setIsLoadingRiwayat(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/ujian/riwayat`, { credentials: 'include' });
      if (res.ok) setRiwayatData(await res.json());
    } catch { } finally { setIsLoadingRiwayat(false); }
  };

  const adminCount = akunList.filter(a => a.role === 'ADMIN').length;
  const now = new Date();
  const sesiAktif = sesiList.filter(s => new Date(s.deadline) > now).length;
  const sesiExpired = sesiList.filter(s => new Date(s.deadline) <= now).length;

  const LiquidBackground = () => (
    <>
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-float pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: '2s' }} />
    </>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050a]">
      <LiquidBackground />

      { }
      <nav className="glass-panel sticky top-0 z-40 h-16 flex items-center justify-between px-8 border-b border-white/[0.05]">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg text-white tracking-wide flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <span className="text-white text-xs">D</span>
            </div>
            DCC<span className="text-cyan-400 font-light">Admin</span>
          </span>
          <div className="flex items-center gap-2">
            {[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Ujian', path: '/ujian-admin' }, { label: 'Penilaian', path: '/penilaian' }, { label: 'Latihan Ketik', path: '/typing' }].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`text-xs font-medium tracking-wide px-4 py-2 rounded-xl transition-all ${path === '/dashboard' ? 'text-white bg-white/10 shadow-sm' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/50 font-medium">{user?.nama}</span>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all font-medium border border-red-500/20">
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-8 py-10">
        { }
        <div className="flex justify-between items-start mb-10 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight mb-2 text-glow">Dashboard Pengelolaan</h1>
            <p className="text-sm text-white/50">Kelola akses staff, master siswa, dan sesi ujian.</p>
          </div>
          {user?.role === 'ADMIN' && (
            <button onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold tracking-wider uppercase px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] shrink-0">
              + Buat Akun
            </button>
          )}
        </div>

        { }
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Staff', value: akunList.length, color: 'text-white', bg: 'bg-white/5' },
            { label: 'Admin', value: adminCount, color: 'text-cyan-400', bg: 'bg-cyan-500/5' },
            { label: 'Sesi Aktif', value: sesiAktif, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
            { label: 'Sesi Expired', value: sesiExpired, color: 'text-red-400', bg: 'bg-red-500/5' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`glass-panel px-6 py-6 rounded-2xl ${bg} border border-white/5 transition-all hover:scale-[1.02]`}>
              <p className="text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2 font-semibold">{label}</p>
              <p className={`text-4xl font-bold ${color} text-glow`}>{value}</p>
            </div>
          ))}
        </div>

        { }
        {user?.role === 'ADMIN' && (
          <div className="glass-panel border border-white/10 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-white/20">
            <div>
              <p className="text-xs tracking-[0.1em] uppercase text-white/70 mb-1 font-semibold">Bulk Import Sesi</p>
              <p className="text-[11px] text-white/40">Import via CSV atau langsung dari file Excel (.xlsx)</p>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <input ref={previewInputRef} type="file" accept=".csv"
                onChange={e => { const f = e.target.files?.[0] || null; setCsvFile(f); if (f) handlePreviewCSV(f); }}
                className="flex-1 min-w-40 text-xs text-white/50 bg-black/20 border border-white/10 rounded-xl px-3 py-2 cursor-pointer file:bg-white/10 file:border-0 file:rounded-lg file:text-white/80 file:font-semibold file:text-[10px] file:tracking-[0.1em] file:uppercase file:px-3 file:py-1.5 file:mr-3 file:cursor-pointer file:hover:bg-white/20 file:transition-all"
              />
              {csvFile && (
                <button onClick={() => csvFile && handlePreviewCSV(csvFile)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-cyan-200 text-[10px] font-bold tracking-[0.08em] uppercase px-4 py-2.5 rounded-xl transition-all">
                  Preview Ulang
                </button>
              )}
            </div>
          </div>
        )}

        { }
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
          {[
            { key: 'akun', label: `Akun Staff (${akunList.length})` },
            { key: 'siswa', label: `Master Siswa (${siswaList.length})` },
            { key: 'sesi', label: `Sesi Ujian (${sesiList.length})` },
            { key: 'hasil', label: 'Hasil & Riwayat' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`text-xs tracking-wide font-medium px-6 py-3 rounded-xl transition-all whitespace-nowrap ${activeTab === key
                  ? 'text-white bg-blue-500/20 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                  : 'text-white/40 border border-transparent hover:text-white/80 hover:bg-white/5'
                }`}>{label}</button>
          ))}
        </div>

        { }
        {activeTab === 'akun' && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
            {isLoadingData ? (
              <div className="p-12 text-center text-white/40 text-sm flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" /> Memuat...
              </div>
            ) : akunList.length === 0 ? (
              <div className="p-12 text-center text-white/30 text-sm">Belum ada akun staff terdaftar.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="p-4 w-12 text-center">
                        <input type="checkbox" className="accent-blue-500 w-4 h-4 rounded"
                          checked={selectedAkun.size === akunList.length && akunList.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedAkun(new Set(akunList.map(a => a.id)));
                            else setSelectedAkun(new Set());
                          }}
                        />
                      </th>
                      {['ID', 'Nama', 'Username', 'Role'].map(h => (
                        <th key={h} className="px-4 py-4 text-[10px] tracking-[0.15em] text-white/40 uppercase font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {akunList.map((a) => (
                      <tr key={a.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${selectedAkun.has(a.id) ? 'bg-blue-500/10' : ''}`}>
                        <td className="p-4 text-center">
                          <input type="checkbox" className="accent-blue-500 w-4 h-4 rounded"
                            checked={selectedAkun.has(a.id)}
                            onChange={(e) => {
                              const ns = new Set(selectedAkun);
                              if (e.target.checked) ns.add(a.id);
                              else ns.delete(a.id);
                              setSelectedAkun(ns);
                            }}
                          />
                        </td>
                        <td className="px-4 py-4 text-xs text-white/30 font-mono">{a.id}</td>
                        <td className="px-4 py-4 text-sm text-white/90 font-medium">{a.nama}</td>
                        <td className="px-4 py-4 text-sm text-cyan-300 font-mono">{a.username}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold tracking-wider ${a.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                            {a.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedAkun.size > 0 && user?.role === 'ADMIN' && (
              <div className="p-4 border-t border-white/10 bg-red-500/5 flex justify-between items-center">
                <span className="text-xs text-red-300 font-medium">{selectedAkun.size} akun dipilih</span>
                <button onClick={handleBulkDeleteAkun} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs px-4 py-2 rounded-xl transition-all font-medium">
                  Hapus Terpilih
                </button>
              </div>
            )}
          </div>
        )}

        { }
        {activeTab === 'siswa' && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">Database Master Siswa</h3>
                <p className="text-xs text-white/50">Data di-upsert berdasarkan Stambuk</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowImportModal(true)}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-4 py-2.5 rounded-xl transition-all font-medium flex items-center gap-2 shadow-sm">
                  <FileUp className="w-4 h-4 text-emerald-400" />
                  Import Excel
                </button>
                <button onClick={() => setShowGenerateModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] font-medium flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Generate Sesi Ujian
                </button>
              </div>
            </div>

            {isLoadingSiswa ? (
              <div className="p-12 text-center text-white/40 text-sm flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" /> Memuat Data...
              </div>
            ) : siswaList.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-white/20">
                  <Users className="w-8 h-8" />
                </div>
                <p className="text-white/40 text-sm">Belum ada data siswa.</p>
                <p className="text-white/30 text-xs mt-1">Silakan import data melalui file Excel.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      {['No', 'Stambuk', 'Nama', 'Kelas', 'No. Absen', 'Daerah', 'Rayon'].map(h => (
                        <th key={h} className="px-4 py-4 text-[10px] tracking-[0.15em] text-white/40 uppercase font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {siswaList.map((s, i) => (
                      <tr key={s.stambuk} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-4 text-xs text-white/30">{i + 1}</td>
                        <td className="px-4 py-4 text-sm text-cyan-300 font-mono font-semibold tracking-wide">{s.stambuk}</td>
                        <td className="px-4 py-4 text-sm text-white/90 font-medium">{s.nama}</td>
                        <td className="px-4 py-4 text-xs text-white/50">{s.kelas}</td>
                        <td className="px-4 py-4 text-xs text-white/50">{s.noAbsen}</td>
                        <td className="px-4 py-4 text-xs text-white/50">{s.daerah}</td>
                        <td className="px-4 py-4 text-xs text-white/50">{s.rayon}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        { }
        {activeTab === 'sesi' && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
            {isLoadingSesi ? (
              <div className="p-12 text-center text-white/40 text-sm flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" /> Memuat Sesi...
              </div>
            ) : sesiList.length === 0 ? (
              <div className="p-12 text-center text-white/30 text-sm">Belum ada sesi ujian. Generate dari tab Master Siswa.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="p-4 w-12 text-center">
                        <input type="checkbox" className="accent-blue-500 w-4 h-4 rounded"
                          checked={selectedSesi.size === sesiList.length && sesiList.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSesi(new Set(sesiList.map(s => s.token)));
                            else setSelectedSesi(new Set());
                          }}
                        />
                      </th>
                      {['Token', 'Stambuk', 'Nama', 'Kelas', 'Ujian ID', 'Deadline', 'Sisa Waktu', 'Aksi'].map(h => (
                        <th key={h} className="px-4 py-4 text-[10px] tracking-[0.15em] text-white/40 uppercase font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sesiList.map(s => {
                      const now = new Date();
                      const dl = new Date(s.deadline);
                      const isExpired = now > dl;
                      let diffMin = Math.round((dl.getTime() - now.getTime()) / 60000);
                      const sisaTxt = isExpired ? 'Expired' : `${diffMin}mnt`;
                      return (
                        <tr key={s.token} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${selectedSesi.has(s.token) ? 'bg-blue-500/10' : ''}`}>
                          <td className="p-4 text-center">
                            <input type="checkbox" className="accent-blue-500 w-4 h-4 rounded"
                              checked={selectedSesi.has(s.token)}
                              onChange={(e) => {
                                const ns = new Set(selectedSesi);
                                if (e.target.checked) ns.add(s.token);
                                else ns.delete(s.token);
                                setSelectedSesi(ns);
                              }}
                            />
                          </td>
                          <td className="px-4 py-4 text-sm text-cyan-300 font-mono font-bold tracking-widest">{s.token}</td>
                          <td className="px-4 py-4 text-xs text-white/50 font-mono tracking-wider">{s.stambuk || '-'}</td>
                          <td className="px-4 py-4 text-sm text-white/90 font-medium">{s.nama}</td>
                          <td className="px-4 py-4 text-xs text-white/50">{s.kelas}</td>
                          <td className="px-4 py-4 text-xs text-cyan-300/70 font-mono tracking-wider">{s.ujianId}</td>
                          <td className="px-4 py-4 text-xs text-white/40">{new Date(s.deadline).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-4 text-xs">
                            <span className={`px-2 py-1 rounded-lg font-semibold tracking-wide border ${isExpired ? 'bg-red-500/10 text-red-400 border-red-500/30' : diffMin < 30 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                              {sisaTxt}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button onClick={() => handleOpenEditSesi(s)} className="bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg transition-colors border border-white/10">Edit</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {selectedSesi.size > 0 && user?.role === 'ADMIN' && (
              <div className="p-4 border-t border-white/10 bg-red-500/5 flex justify-between items-center">
                <span className="text-xs text-red-300 font-medium">{selectedSesi.size} sesi dipilih</span>
                <button onClick={handleBulkDeleteSesi} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs px-4 py-2 rounded-xl transition-all font-medium">
                  Hapus Terpilih
                </button>
              </div>
            )}
          </div>
        )}

        { }
        {activeTab === 'hasil' && (
          <div className="space-y-6">
            { }
            <div className="flex gap-2">
              {[{ key: 'hasil', label: 'Hasil Ujian' }, { key: 'riwayat', label: 'Riwayat Dihapus' }].map(({ key, label }) => (
                <button key={key} onClick={() => setHasilSubTab(key as any)}
                  className={`text-xs font-bold px-5 py-2.5 rounded-xl border transition-all ${hasilSubTab === key ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'text-white/40 border-white/10 hover:text-white/70 hover:bg-white/5'}`}>
                  {label}
                </button>
              ))}
            </div>

            { }
            {hasilSubTab === 'hasil' && (
              <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                <div className="p-6 border-b border-white/10 bg-white/5 flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Hasil Ujian Siswa</h3>
                    <p className="text-xs text-white/40">Pilih ujian untuk melihat rekap nilai</p>
                  </div>
                  <select value={selectedUjianId}
                    onChange={e => { setSelectedUjianId(e.target.value); fetchHasil(e.target.value); }}
                    className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500/50 outline-none min-w-[220px]">
                    <option value="">— Pilih Ujian —</option>
                    {ujianAllList.map(u => <option key={u.id} value={u.id}>{u.judul}</option>)}
                  </select>
                </div>
                {!selectedUjianId ? (
                  <div className="p-16 text-center text-white/20 text-sm">Pilih ujian di atas untuk melihat hasil.</div>
                ) : isLoadingHasil ? (
                  <div className="p-12 flex items-center justify-center gap-3 text-white/40 text-sm">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" /> Memuat...
                  </div>
                ) : hasilData.length === 0 ? (
                  <div className="p-16 text-center text-white/30 text-sm">Belum ada siswa yang mengumpulkan tugas untuk ujian ini.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 border-b border-white/10">
                          <tr>
                            {['No', 'Nama', 'Kelas', 'No.Absen', 'Waktu Kumpul', 'Status', 'Nilai'].map(h => (
                              <th key={h} className="px-4 py-4 text-[10px] tracking-[0.15em] text-white/40 uppercase font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {hasilData.map((t, i) => (
                            <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 text-xs text-white/30">{i + 1}</td>
                              <td className="px-4 py-3 text-sm text-white/90 font-medium">{t.nama}</td>
                              <td className="px-4 py-3 text-xs text-white/50">{t.kelas}</td>
                              <td className="px-4 py-3 text-xs text-white/50">{t.noAbsen}</td>
                              <td className="px-4 py-3 text-xs text-white/40">{new Date(t.submittedAt).toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-lg border ${t.status === 'DINILAI' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                    t.status === 'DIKEMBALIKAN' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                                      'bg-white/5 text-white/30 border-white/10'
                                  }`}>{t.status}</span>
                              </td>
                              <td className="px-4 py-3">
                                {t.nilai !== null
                                  ? <span className={`text-lg font-bold ${t.nilai >= 75 ? 'text-emerald-400' : t.nilai >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{t.nilai}</span>
                                  : <span className="text-white/20 text-xs">—</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-white/5 flex gap-6 text-xs text-white/50">
                      <span>Total: <strong className="text-white">{hasilData.length}</strong></span>
                      <span>Dinilai: <strong className="text-emerald-400">{hasilData.filter(t => t.nilai !== null).length}</strong></span>
                      <span>Rata-rata: <strong className="text-cyan-400">{hasilData.filter(t => t.nilai !== null).length > 0 ? (hasilData.filter(t => t.nilai !== null).reduce((s, t) => s + (t.nilai ?? 0), 0) / hasilData.filter(t => t.nilai !== null).length).toFixed(1) : '—'}</strong></span>
                    </div>
                  </>
                )}
              </div>
            )}

            { }
            {hasilSubTab === 'riwayat' && (
              <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-white">Riwayat Ujian Dihapus</h3>
                    <p className="text-xs text-white/40">Ujian yang dihapus masih menyimpan data tugas siswa</p>
                  </div>
                  <button onClick={fetchRiwayat} className="text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all">Refresh</button>
                </div>
                {isLoadingRiwayat ? (
                  <div className="p-12 flex items-center justify-center gap-3 text-white/40 text-sm">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" /> Memuat...
                  </div>
                ) : riwayatData.length === 0 ? (
                  <div className="p-16 text-center text-white/20 text-sm">Belum ada ujian yang dihapus.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          {['ID Ujian', 'Judul', 'Durasi', 'Format', 'Tugas Masuk', 'Dibuat', 'Dihapus'].map(h => (
                            <th key={h} className="px-4 py-4 text-[10px] tracking-[0.15em] text-white/40 uppercase font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {riwayatData.map(u => (
                          <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-[10px] text-red-400/60 font-mono tracking-wider">{u.id}</td>
                            <td className="px-4 py-3 text-sm text-white/70 font-medium">{u.judul}</td>
                            <td className="px-4 py-3 text-xs text-white/40">{u.durasi}m</td>
                            <td className="px-4 py-3 text-xs text-white/40">{u.formatFile.join(', ')}</td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold text-amber-400">{u._count.tugas}</span>
                              <span className="text-[10px] text-white/30 ml-1">tugas</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-white/30">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                            <td className="px-4 py-3 text-xs text-red-400/60">{new Date(u.deletedAt).toLocaleDateString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      { }
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden p-8 shadow-2xl relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full pointer-events-none" />
            <h2 className="text-2xl font-bold text-white mb-6 relative text-glow">Buat Akun Staff</h2>
            <form onSubmit={handleCreateAkun} className="space-y-4 relative">
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Nama Lengkap</label>
                <input required type="text" value={newAkun.nama} onChange={e => setNewAkun({ ...newAkun, nama: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Username</label>
                <input required type="text" value={newAkun.username} onChange={e => setNewAkun({ ...newAkun, username: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Password</label>
                <input required type="password" value={newAkun.password} onChange={e => setNewAkun({ ...newAkun, password: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Role</label>
                <select value={newAkun.role} onChange={e => setNewAkun({ ...newAkun, role: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all cursor-pointer">
                  <option value="GURU" className="bg-[#0b0f19]">Guru</option>
                  <option value="ADMIN" className="bg-[#0b0f19]">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 hover:text-white text-xs px-4 py-3.5 rounded-xl transition-all font-semibold">Batal</button>
                <button type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold tracking-wider uppercase px-4 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      { }
      {editingSesi && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setEditingSesi(null); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden p-8 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white mb-6 text-glow">Edit Sesi: <span className="text-cyan-400 font-mono text-xl">{editingSesi.token}</span></h2>
            {editSesiError && <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl mb-4 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {editSesiError}
            </div>}
            <form onSubmit={handleSaveEditSesi} className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Nama Siswa</label>
                <input required type="text" value={editSesiForm.nama} onChange={e => setEditSesiForm({ ...editSesiForm, nama: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all shadow-inner" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Kelas</label>
                  <input required type="text" value={editSesiForm.kelas} onChange={e => setEditSesiForm({ ...editSesiForm, kelas: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all shadow-inner" />
                </div>
                <div className="w-1/3">
                  <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">No.Absen</label>
                  <input required type="text" value={editSesiForm.noAbsen} onChange={e => setEditSesiForm({ ...editSesiForm, noAbsen: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all shadow-inner" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] tracking-wider text-white/40 uppercase mb-1.5 font-semibold">Deadline / Waktu Berakhir</label>
                <input required type="datetime-local" value={editSesiForm.deadline} onChange={e => setEditSesiForm({ ...editSesiForm, deadline: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all shadow-inner" />
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setEditingSesi(null)} className="flex-1 border border-white/10 hover:bg-white/5 text-white/60 text-xs px-4 py-3.5 rounded-xl transition-all font-semibold">Batal</button>
                <button type="submit" disabled={isSavingSesi} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white text-xs font-bold px-4 py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {isSavingSesi ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      { }
      {showCsvPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setShowCsvPreview(false); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
            <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center shrink-0 bg-white/5 relative z-10">
              <div>
                <h3 className="text-xl font-bold text-white text-glow">Preview Data CSV</h3>
                <p className="text-[11px] text-white/30 mt-1">{csvPreviewData.length} baris ditemukan</p>
              </div>
              <button onClick={() => setShowCsvPreview(false)} className="text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-auto flex-1 p-2">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-[#0d0d14]/90 backdrop-blur-md z-10 rounded-t-xl">
                  <tr className="border-b border-white/10">
                    {['#', 'Nama', 'Kelas', 'No. Absen', 'Ujian ID', 'Deadline', 'Status'].map(h => (
                      <th key={h} className="px-4 py-4 font-bold text-[10px] tracking-[0.15em] text-white/40 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreviewData.map((row, i) => {
                    const valid = row.nama && row.kelas && row.noabsen && row.ujianid;
                    return (
                      <tr key={i} className={`border-b border-white/5 ${valid ? 'hover:bg-white/5' : 'bg-red-500/5'}`}>
                        <td className="px-4 py-4 font-mono text-xs text-white/30">{i + 1}</td>
                        <td className="px-4 py-4 text-sm text-white font-medium">{row.nama || <span className="text-red-400/60 text-[11px]">kosong</span>}</td>
                        <td className="px-4 py-4 text-xs text-white/60">{row.kelas || '—'}</td>
                        <td className="px-4 py-4 text-xs text-white/60">{row.noabsen || '—'}</td>
                        <td className="px-4 py-4 text-xs text-cyan-300 font-mono tracking-wider">{row.ujianid || <span className="text-red-400/60">—</span>}</td>
                        <td className="px-4 py-4 text-xs text-white/40">{row.deadline || <span className="text-amber-400/60">—</span>}</td>
                        <td className="px-4 py-4">
                          {valid
                            ? <span className="text-[10px] font-bold tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-lg">OK</span>
                            : <span className="text-[10px] font-bold tracking-wider text-red-300 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-lg">ERROR</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-8 py-5 border-t border-white/10 flex justify-between items-center shrink-0 bg-white/5 relative z-10">
              <p className="text-xs font-medium">
                <span className="text-emerald-400 mr-4">{csvPreviewData.filter(r => r.nama && r.kelas && r.noabsen && r.ujianid).length} valid</span>
                <span className="text-red-400">{csvPreviewData.filter(r => !r.nama || !r.kelas || !r.noabsen || !r.ujianid).length} error</span>
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowCsvPreview(false)}
                  className="border border-white/10 hover:bg-white/5 text-white/60 hover:text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all">Batal</button>
                <button onClick={handleConfirmUpload} disabled={isUploading}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 disabled:opacity-40 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {isUploading ? 'Mengupload...' : 'Konfirmasi Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      { }
      {showImportModal && <ImportSiswaModal onClose={() => setShowImportModal(false)} onImported={() => { fetchSiswa(); }} />}
      {showGenerateModal && <GenerateSesiModal onClose={() => setShowGenerateModal(false)} onGenerated={() => { fetchSesi(); }} />}
    </div>
  );
}
