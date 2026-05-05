import { useState, useRef } from 'react';
import { parseXlsx, rowsToSiswa, type SiswaRow } from '../utils/excelParser';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function ImportSiswaModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<'config' | 'preview' | 'done'>('config');
  const [siswaData, setSiswaData] = useState<SiswaRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setError('Hanya file .xlsx atau .xls'); return; }
    setError(''); setIsLoading(true);
    try {
      const rows = await parseXlsx(file);
      const parsed = rowsToSiswa(rows);
      setSiswaData(parsed);
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsImporting(true); setError('');
    try {
      const res = await fetch('http://localhost:5000/admin/siswa/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siswa: siswaData.map(s => ({ 
            stambuk: s.stambuk, 
            noAbsen: s.noAbsen, 
            nama: s.nama, 
            kelas: s.kelas,
            daerah: s.daerah,
            rayon: s.rayon
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal import');
      setImportedCount(data.totalData || siswaData.length);
      setStep('done');
      onImported();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#13131a] border border-white/10 rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-center shrink-0">
          <div>
            <span className="font-mono text-xs tracking-[0.1em] uppercase text-white/70">Import Master Data Siswa</span>
            <p className="font-mono text-[11px] text-white/25 mt-0.5">
              {step === 'config' && 'Kolom: No Absen · Stambuk · Nama · Kelas · Daerah · Rayon'}
              {step === 'preview' && `${siswaData.length} siswa ditemukan — periksa lalu konfirmasi`}
              {step === 'done' && `✓ ${importedCount} siswa berhasil diimport`}
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── STEP: CONFIG & UPLOAD ── */}
          {step === 'config' && (
            <div className="p-6 space-y-5">
              
              {/* Drop zone */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2">File Excel Database Siswa</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  className={`border-2 border-dashed rounded-sm p-14 text-center cursor-pointer transition-all ${dragOver ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-white/10 hover:border-white/25'}`}>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-7 h-7 border-2 border-white/10 border-t-emerald-400 rounded-full animate-spin" />
                      <p className="font-mono text-[11px] text-white/30">Memproses Excel...</p>
                    </div>
                  ) : (
                    <>
                      <p className="font-mono text-3xl mb-3 text-white/10">📊</p>
                      <p className="font-mono text-[10px] tracking-[0.2em] text-white/25 uppercase mb-1">Drag & drop atau klik</p>
                      <p className="text-[11px] text-white/15">.xlsx · .xls</p>
                    </>
                  )}
                </div>
              </div>

              {/* Format hint */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-sm p-4">
                <p className="font-mono text-[10px] text-white/30 uppercase tracking-wider mb-2">Format kolom yang diharapkan:</p>
                <div className="grid grid-cols-6 gap-2">
                  {['A: No Absen', 'B: Stambuk', 'C: Nama', 'D: Kelas', 'E: Daerah', 'F: Rayon'].map((col, i) => (
                    <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-sm px-2 py-1.5 text-center">
                      <p className="font-mono text-[9px] text-white/20">{col.split(':')[0]}</p>
                      <p className="font-mono text-[10px] text-white/50">{col.split(': ')[1]}</p>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-[10px] text-white/20 mt-2 text-amber-500/70">Penting: Stambuk dan Nama wajib diisi. Data dengan stambuk yang sama akan diupdate (Upsert).</p>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/25 rounded-sm px-4 py-3 font-mono text-[11px] text-red-300">{error}</div>}
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-[#0d0d14]">
                    <tr className="border-b border-white/[0.06]">
                      {['#', 'No.Absen', 'Stambuk', 'Nama', 'Kelas', 'Daerah', 'Rayon'].map(h => (
                        <th key={h} className="px-4 py-2.5 font-mono text-[9px] tracking-[0.15em] text-white/20 uppercase font-normal whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {siswaData.map((s, i) => (
                      <tr key={i} className={`border-b border-white/[0.04] transition-colors ${!s.stambuk ? 'bg-red-500/[0.05]' : 'hover:bg-white/[0.02]'}`}>
                        <td className="px-4 py-3 font-mono text-[10px] text-white/20">{i + 1}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-white/50 text-center">{s.noAbsen}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-indigo-300">{s.stambuk || <span className="text-red-400">KOSONG</span>}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium">{s.nama}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-white/50">{s.kelas || '—'}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-white/40">{s.daerah || '—'}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-white/40">{s.rayon || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <div className="m-6 bg-red-500/10 border border-red-500/25 rounded-sm px-4 py-3 font-mono text-[11px] text-red-300">{error}</div>}
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="p-8 flex flex-col items-center justify-center gap-6 text-center min-h-[300px]">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-2xl">✓</div>
              <div>
                <h3 className="font-mono text-lg font-bold text-white mb-2">{importedCount} Data Siswa Berhasil Disimpan</h3>
                <p className="font-mono text-[11px] text-white/30">Data ini akan menjadi acuan saat generate sesi ujian nanti.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-between items-center shrink-0">
          <div className="font-mono text-[10px] text-white/20">
            {step === 'preview' && `${siswaData.length} siswa`}
            {step === 'done' && `✓ Import selesai`}
          </div>
          <div className="flex gap-2.5">
            {step === 'preview' && (
              <>
                <button onClick={() => { setSiswaData([]); setStep('config'); setError(''); }}
                  className="border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-sm transition-all">
                  ← Kembali
                </button>
                <button onClick={handleConfirm} disabled={isImporting}
                  className="bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-[10px] tracking-[0.1em] uppercase px-5 py-2.5 rounded-sm transition-colors">
                  {isImporting ? 'Menyimpan...' : `Simpan ${siswaData.length} Siswa →`}
                </button>
              </>
            )}
            {step === 'done' && (
              <button onClick={onClose}
                className="bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 font-mono text-[10px] tracking-[0.1em] uppercase px-5 py-2.5 rounded-sm transition-colors">
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
