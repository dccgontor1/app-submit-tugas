import { useState, useEffect } from 'react';
import type { Ujian } from '../types';

interface Props {
  onClose: () => void;
  onGenerated: () => void;
}

interface SesiRow {
  token: string;
  nama: string;
  kelas: string;
  noAbsen: number;
  stambuk: string | null;
  deadline: string;
}

export default function GenerateSesiModal({ onClose, onGenerated }: Props) {
  const [step, setStep] = useState<'config' | 'preview' | 'done'>('config');
  const [ujianList, setUjianList] = useState<Ujian[]>([]);
  const [kelasList, setKelasList] = useState<string[]>([]);
  
  const [selectedUjian, setSelectedUjian] = useState('');
  const [selectedKelas, setSelectedKelas] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  
  const [generatedData, setGeneratedData] = useState<SesiRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch Ujian
    fetch('http://localhost:5000/admin/ujian', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Ujian[]) => {
        setUjianList(data);
        if (data.length > 0) setSelectedUjian(data[0].id);
      })
      .catch(() => {});

    // Fetch Kelas Unik dari Siswa
    fetch('http://localhost:5000/admin/siswa/kelas', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: string[]) => setKelasList(data))
      .catch(() => {});
  }, []);

  const toggleKelas = (k: string) => {
    if (selectedKelas.includes(k)) {
      setSelectedKelas(selectedKelas.filter(x => x !== k));
    } else {
      setSelectedKelas([...selectedKelas, k]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedUjian) { setError('Pilih ujian terlebih dahulu'); return; }
    if (selectedKelas.length === 0) { setError('Pilih minimal 1 kelas'); return; }
    if (!deadline) { setError('Tentukan deadline ujian'); return; }

    setIsGenerating(true);
    setError('');

    try {
      const res = await fetch(`http://localhost:5000/admin/ujian/${selectedUjian}/generate-sesi-kelas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kelasList: selectedKelas,
          deadline: new Date(deadline).toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal generate sesi');

      setGeneratedData(data.sessions);
      setStep('done');
      onGenerated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Print helper (opens new window) ─────────────────────────────────────────
  const handlePrint = () => {
    const ujianJudul = ujianList.find(u => u.id === selectedUjian)?.judul || selectedUjian;
    const deadlineStr = new Date(deadline).toLocaleString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const w = window.open('', '_blank', 'width=960,height=720');
    if (!w) { alert('Izinkan popup di browser untuk mencetak.'); return; }

    const cards = generatedData.map(s => `
      <div class="card">
        <div class="card-top">
          <span class="label-small">KARTU UJIAN SANTRI</span>
          <span class="ujian-name">${ujianJudul}</span>
        </div>
        <div class="info">
          <div class="info-row"><span>Nama</span><span class="info-val"><b>${s.nama}</b></span></div>
          <div class="info-row"><span>Stambuk</span><span class="info-val">${s.stambuk || '—'}</span></div>
          <div class="info-row"><span>Kelas</span><span class="info-val">${s.kelas || '—'}</span></div>
          <div class="info-row"><span>No. Absen</span><span class="info-val">${s.noAbsen}</span></div>
          <div class="info-row"><span>Deadline</span><span class="info-val">${deadlineStr}</span></div>
        </div>
        <div class="token-box">
          <div class="token-label">KODE LOGIN UJIAN</div>
          <div class="token">${s.token}</div>
        </div>
      </div>`).join('');

    w.document.write(`<!DOCTYPE html><html lang="id"><head>
      <meta charset="UTF-8">
      <title>Kartu Ujian — ${ujianJudul}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Courier New',monospace;background:#eee;padding:16px}
        h2{text-align:center;margin-bottom:16px;font-size:15px;letter-spacing:.1em}
        .controls{text-align:center;margin-bottom:20px}
        .controls button{background:#4f46e5;color:#fff;border:none;padding:10px 28px;border-radius:4px;cursor:pointer;font:bold 13px monospace;letter-spacing:.1em;text-transform:uppercase;margin:0 6px}
        .controls button.secondary{background:#555}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        .card{background:#fff;border:1.5px solid #333;padding:12px;break-inside:avoid;page-break-inside:avoid}
        .card-top{border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-end}
        .label-small{font-size:8px;letter-spacing:.2em;color:#888;text-transform:uppercase}
        .ujian-name{font-size:11px;font-weight:bold;color:#222;max-width:60%;text-align:right}
        .info{margin-bottom:10px}
        .info-row{display:flex;justify-content:space-between;font-size:10.5px;padding:2px 0;border-bottom:1px dotted #eee}
        .info-row span:first-child{color:#666;width:65px;flex-shrink:0}
        .info-val{text-align:right;font-weight:normal}
        .token-box{border:2px dashed #4f46e5;text-align:center;padding:10px 6px;background:#f5f5ff}
        .token-label{font-size:8px;letter-spacing:.25em;color:#4f46e5;text-transform:uppercase;margin-bottom:4px}
        .token{font-size:30px;font-weight:bold;letter-spacing:.45em;color:#1e1b4b}
        @media print{body{background:#fff;padding:4mm}.controls{display:none}.grid{gap:6px}}
        @page{size:A4;margin:1cm}
      </style>
    </head><body>
      <div class="controls">
        <button onclick="window.print()">🖨&nbsp; Cetak Kartu (${generatedData.length} siswa)</button>
        <button class="secondary" onclick="window.close()">Tutup</button>
      </div>
      <div class="grid">${cards}</div>
    </body></html>`);
    w.document.close();
  };

  const inputCls = 'w-full bg-white/[0.04] border border-white/10 rounded-sm px-4 py-3 text-sm text-[#e8e6e0] outline-none focus:border-indigo-500/60 transition-colors appearance-none';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#13131a] border border-white/10 rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center shrink-0">
          <div>
            <span className="font-mono text-xs tracking-[0.1em] uppercase text-white/70">Generate Sesi Ujian per Kelas</span>
            <p className="font-mono text-[11px] text-white/25 mt-0.5">
              Otomatis buat sesi (token login) untuk siswa yang ada di Master Data
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'config' && (
            <div className="space-y-6">
              {/* Ujian + Deadline grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">Pilih Ujian</label>
                  <select value={selectedUjian} onChange={e => setSelectedUjian(e.target.value)} className={inputCls + ' [color-scheme:dark] cursor-pointer'}>
                    {ujianList.length === 0 && <option value="">Belum ada ujian</option>}
                    {ujianList.map(u => <option key={u.id} value={u.id} className="bg-[#13131a]">{u.judul}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">Tentukan Deadline Ujian</label>
                  <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls + ' [color-scheme:dark]'} />
                </div>
              </div>

              {/* Multi-select Kelas */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">Pilih Kelas (Bisa Multi)</label>
                <div className="bg-white/[0.02] border border-white/10 rounded-sm p-4 max-h-[200px] overflow-y-auto flex flex-wrap gap-2">
                  {kelasList.length === 0 && <p className="text-xs text-white/30">Belum ada data kelas. Import Excel database siswa dulu.</p>}
                  {kelasList.map(k => (
                    <button
                      key={k}
                      onClick={() => toggleKelas(k)}
                      className={`px-3 py-1.5 rounded-sm font-mono text-xs transition-all border ${
                        selectedKelas.includes(k) 
                          ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' 
                          : 'bg-white/[0.05] border-white/10 text-white/40 hover:bg-white/[0.1] hover:border-white/20'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/25 rounded-sm px-4 py-3 font-mono text-[11px] text-red-300">{error}</div>}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center gap-6 text-center py-10">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-2xl text-emerald-400">✓</div>
              <div>
                <h3 className="font-mono text-lg font-bold text-white mb-2">{generatedData.length} Sesi Aktif Dibuat</h3>
                <p className="font-mono text-[11px] text-white/30">
                  Ujian: <span className="text-white/60">{ujianList.find(u=>u.id===selectedUjian)?.judul}</span><br/>
                  Kelas: <span className="text-white/60">{selectedKelas.join(', ')}</span>
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[11px] tracking-[0.15em] uppercase px-8 py-3.5 rounded-sm transition-colors flex items-center gap-2">
                🖨 Cetak Kartu Ujian (${generatedData.length})
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-between items-center shrink-0">
          <div className="font-mono text-[10px] text-white/20">
            {step === 'config' && `Pilih konfigurasi generate`}
            {step === 'done' && `✓ Selesai`}
          </div>
          <div className="flex gap-2.5">
            {step === 'config' && (
              <button onClick={handleGenerate} disabled={isGenerating}
                className="bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-[10px] tracking-[0.1em] uppercase px-6 py-2.5 rounded-sm transition-colors">
                {isGenerating ? 'Memproses...' : `▶ Generate Sesi Sekarang`}
              </button>
            )}
            {step === 'done' && (
              <button onClick={onClose}
                className="bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] tracking-[0.1em] uppercase px-5 py-2.5 rounded-sm transition-colors">
                Tutup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
