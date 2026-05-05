const fs = require('fs');

const headFile = fs.readFileSync('client/src/pages/UjianAdminPage.tsx', 'utf8');

// The original file is too corrupted. Let's get the HEAD version.
const headContent = fs.readFileSync('UjianAdminPage_HEAD.tsx', 'utf8');

const targetStart = '  // Group sessions by class';
const targetEnd = '      {/* Modal Buat Ujian */}';

const startIndex = headContent.indexOf(targetStart);
const endIndex = headContent.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
    console.log("Could not find targets in HEAD");
    process.exit(1);
}

const replacement = `  // Group sessions by batch (deadline)
  const groupedBatches = sesiList.reduce<Record<string, Sesi[]>>((acc, s) => {
    const key = s.deadline ? new Date(s.deadline).getTime().toString() : 'no-deadline';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});
  const sortedBatches = Object.keys(groupedBatches).sort((a, b) => Number(a) - Number(b));

  const handleDeleteSesi = async (token: string, nama: string) => {
    if (!confirm(\`Hapus sesi atas nama \${nama}?\`)) return;
    try {
      const res = await fetch(\`/admin/sesi/\${token}\`, { method: 'DELETE' });
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
      await Promise.all(tokens.map(t => fetch(\`/admin/sesi/\${t}\`, { method: 'DELETE' })));
      if (selectedUjian) fetchMonitor(selectedUjian.id);
    } catch (e) {
      alert('Terjadi kesalahan saat menghapus batch');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050a]">
      {orbs}

      {/* Navbar */}
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
                className={\`text-xs font-medium px-4 py-2 rounded-xl transition-all \${path === '/ujian-admin' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}\`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {polling && <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Live</span></div>}
          <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all border border-red-500/20">Keluar</button>
        </div>
      </nav>

      {/* Exam Selector Bar */}
      <div className="border-b border-white/[0.05] bg-black/20 backdrop-blur-sm px-8 py-4 flex items-center gap-4 overflow-x-auto relative z-10">
        <button onClick={() => setShowBuatModal(true)}
          className="shrink-0 flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold tracking-wider uppercase px-4 py-2.5 rounded-xl transition-all">
          + Buat Ujian
        </button>
        <div className="w-px h-6 bg-white/10 shrink-0" />
        {ujianList.length === 0
          ? <span className="text-white/20 text-xs font-medium">Belum ada ujian — buat ujian baru</span>
          : ujianList.map(u => (
            <button key={u.id} onClick={() => handleSelectUjian(u)}
              className={\`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap \${
                selectedUjian?.id === u.id
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'border-white/5 text-white/40 hover:text-white/70 hover:bg-white/5'
              }\`}>
              <span className={\`w-1.5 h-1.5 rounded-full \${u.status === 'BERLANGSUNG' ? 'bg-emerald-400 animate-pulse' : u.status === 'SELESAI' ? 'bg-indigo-400' : 'bg-white/20'}\`} />
              {u.judul}
            </button>
          ))
        }
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-8 py-10 relative z-10">

        {/* Empty state */}
        {!selectedUjian && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10">
              <svg className="w-9 h-9 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <div><p className="text-white/20 text-sm font-medium mb-1">Pilih atau buat ujian dari bar di atas</p><p className="text-white/10 text-xs">Ujian = materi yang diuji. Tambah kelas setelah memilih ujian.</p></div>
            <button onClick={() => setShowBuatModal(true)} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold tracking-wider uppercase px-8 py-3.5 rounded-2xl transition-all">+ Buat Ujian Baru</button>
          </div>
        )}

        {selectedUjian && (() => {
          const { status } = selectedUjian;
          const hasSesi = sesiList.length > 0;

          return (
            <div className="space-y-6">
              {/* Exam info row */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={\`text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border \${statusColor[status] ?? 'bg-white/5 text-white/30 border-white/10'}\`}>
                      {status === 'BERLANGSUNG' ? '● Live' : status}
                    </span>
                    <span className="text-[9px] text-white/20 font-mono px-2 py-1 bg-white/5 border border-white/10 rounded-lg">{selectedUjian.id}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-white text-glow">{selectedUjian.judul}</h1>
                  <p className="text-xs text-white/40 mt-1">{selectedUjian.deskripsi || 'Tidak ada deskripsi.'} · {selectedUjian.durasi} menit · {selectedUjian.formatFile.join(', ')}</p>
                </div>
                <button onClick={() => handleHapusUjian(selectedUjian.id, selectedUjian.judul)}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all">Hapus Ujian</button>
              </div>

              {/* MENUNGGU — Setup Phase */}
              {status === 'MENUNGGU' && (
                <>
                  {/* Kelas Batch Cards */}
                  {hasSesi && (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-3">Peserta per Batch Sesi</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        {sortedBatches.map((batchKey, i) => {
                          const batchSiswa = groupedBatches[batchKey];
                          const kelasDalamBatch = Array.from(new Set(batchSiswa.map(s => s.kelas))).sort();
                          return (
                            <div key={batchKey} className="glass-panel rounded-2xl p-5 border border-white/10 relative group">
                              <button onClick={() => handleDeleteBatch(batchKey)} className="absolute top-3 right-3 text-[10px] text-red-500/0 group-hover:text-red-400 bg-red-500/0 group-hover:bg-red-500/10 px-2 py-1 rounded transition-all">Hapus Batch</button>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                  <span className="text-blue-300 font-bold text-xs">B{i+1}</span>
                                </div>
                                <span className="text-[10px] text-white/40">{batchSiswa[0]?.deadline ? '⏰ ' + formatTime(batchSiswa[0].deadline) : '—'}</span>
                              </div>
                              <p className="text-[11px] text-white/60 mb-3 truncate">Kelas: <strong className="text-blue-300">{kelasDalamBatch.join(', ')}</strong></p>
                              <p className="text-2xl font-bold text-white leading-none">{batchSiswa.length}</p>
                              <p className="text-[9px] text-white/30 uppercase tracking-wider mt-1">siswa terdaftar</p>
                            </div>
                          );
                        })}
                        {/* Add class card */}
                        <button onClick={() => { setBatchKelas([]); setBatchDeadline(''); setShowBatchModal(true); }}
                          className="glass-panel rounded-2xl p-5 border border-dashed border-white/15 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-2 text-white/30 hover:text-blue-300">
                          <span className="text-2xl">+</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Tambah Batch Sesi</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!hasSesi && (
                    <div className="flex flex-col items-center justify-center py-16 glass-panel rounded-3xl border border-white/10 gap-4 text-center">
                      <p className="text-white/20 text-sm">Tambah kelas peserta dulu sebelum memulai ujian</p>
                      <button onClick={() => { setBatchKelas([]); setBatchDeadline(''); setShowBatchModal(true); }}
                        className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-sm font-bold tracking-wider uppercase px-8 py-4 rounded-2xl transition-all">
                        + Tambah Kelas Peserta
                      </button>
                    </div>
                  )}

                  {/* BIG START BUTTON */}
                  {hasSesi && (
                    <div className="flex flex-col items-center py-6 gap-3">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">{sesiList.length} siswa siap · klik untuk memulai ujian</p>
                      <button onClick={handleStart}
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white text-lg font-black tracking-widest uppercase px-16 py-5 rounded-3xl transition-all shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:shadow-[0_0_60px_rgba(16,185,129,0.6)] hover:scale-105 active:scale-100">
                        ▶ MULAI UJIAN
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* BERLANGSUNG — Live Monitor */}
              {status === 'BERLANGSUNG' && (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Total', value: sesiList.length, color: 'text-white' },
                      { label: 'Menunggu', value: sesiList.filter(s => !s.startedAt).length, color: 'text-white/40' },
                      { label: 'Sedang Ujian', value: sesiList.filter(s => s.startedAt && !isExpired(s.deadline)).length, color: 'text-emerald-400' },
                      { label: 'Waktu Habis', value: sesiList.filter(s => isExpired(s.deadline)).length, color: 'text-red-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="glass-panel rounded-2xl p-5 border border-white/10 text-center">
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">{label}</p>
                        <p className={\`text-3xl font-bold \${color}\`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => fetchMonitor(selectedUjian.id)} className="text-xs text-white/40 hover:text-white border border-white/10 hover:bg-white/5 px-4 py-2 rounded-xl transition-all">↻ Refresh</button>
                  </div>
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
                              {batchSiswa[0]?.deadline && <span className="font-mono text-cyan-400/70 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg">⏰ {formatTime(batchSiswa[0].deadline)}</span>}
                            </div>
                          </div>
                          <table className="w-full text-left">
                            <thead><tr className="border-b border-white/5 bg-white/[0.01]">
                              {['No', 'Nama', 'Kelas', 'Token', 'Status', 'Aksi'].map((h, idx) => <th key={h} className={\`px-5 py-3 text-[10px] text-white/20 uppercase tracking-widest font-bold \${idx === 5 ? 'text-center' : ''}\`}>{h}</th>)}
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
                                    <td className="px-5 py-3"><span className={\`text-[9px] font-bold uppercase px-2 py-1 rounded-lg border \${cls}\`}>{!on ? 'Tunggu' : exp ? 'Habis' : 'Aktif'}</span></td>
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
                </>
              )}

              {/* SELESAI */}
              {status === 'SELESAI' && (
                <div className="glass-panel rounded-3xl border border-indigo-500/20 p-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-2xl">✓</div>
                  <h2 className="text-xl font-bold text-white">Ujian Selesai</h2>
                  <p className="text-white/40 text-sm">{sesiList.length} siswa terdaftar · Lihat hasil di halaman Penilaian</p>
                  <button onClick={() => navigate('/penilaian')} className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold tracking-wider uppercase px-6 py-3 rounded-xl transition-all">→ Ke Penilaian</button>
                </div>
              )}
            </div>
          );
        })()}
      </main>
`;

const finalFile = headContent.substring(0, startIndex) + replacement + headContent.substring(endIndex);
fs.writeFileSync('client/src/pages/UjianAdminPage.tsx', finalFile, 'utf8');
console.log("Restored cleanly");
