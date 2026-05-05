const fs = require('fs');

const content = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');
const returnIndex = content.indexOf('  return (');

if (returnIndex === -1) {
  console.log("Could not find return statement");
  process.exit(1);
}

const beforeReturn = content.substring(0, returnIndex);

const newReturn = `  // Liquid / Orb Backgrounds
  const LiquidBackground = () => (
    <>
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-float pointer-events-none" style={{ animationDelay: '0s' }} />
      <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] animate-float pointer-events-none" style={{ animationDelay: '2s' }} />
    </>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050a]">
      <LiquidBackground />
      
      {/* Navbar */}
      <nav className="glass-panel sticky top-0 z-40 h-16 flex items-center justify-between px-8 border-b border-white/[0.05]">
        <div className="flex items-center gap-8">
          <span className="font-bold text-lg text-white tracking-wide flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <span className="text-white text-xs">D</span>
            </div>
            DCC<span className="text-cyan-400 font-light">Admin</span>
          </span>
          <div className="flex items-center gap-2">
            {[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Ujian', path: '/ujian-admin' }, { label: 'Penilaian', path: '/penilaian' }].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)}
                className={\`text-xs font-medium tracking-wide px-4 py-2 rounded-xl transition-all \${path === '/dashboard' ? 'text-white bg-white/10 shadow-sm' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}\`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/50 font-medium">{user?.nama}</span>
          <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all font-medium border border-red-500/20">Keluar</button>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
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

        {/* Stat Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Staff',  value: akunList.length, color: 'text-white', bg: 'bg-white/5' },
            { label: 'Admin',        value: adminCount,       color: 'text-cyan-400', bg: 'bg-cyan-500/5' },
            { label: 'Sesi Aktif',   value: sesiAktif,        color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
            { label: 'Sesi Expired', value: sesiExpired,      color: 'text-red-400', bg: 'bg-red-500/5' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={\`glass-panel px-6 py-6 rounded-2xl \${bg} border border-white/5 transition-all hover:scale-[1.02]\`}>
              <p className="text-[10px] tracking-[0.15em] text-white/40 uppercase mb-2 font-semibold">{label}</p>
              <p className={\`text-4xl font-bold \${color} text-glow\`}>{value}</p>
            </div>
          ))}
        </div>

        {/* CSV Card */}
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
          {(['akun', 'siswa', 'sesi'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={\`text-xs tracking-wide font-medium px-6 py-3 rounded-xl transition-all whitespace-nowrap \${activeTab === tab ? 'text-white bg-blue-500/20 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-white/40 border border-transparent hover:text-white/80 hover:bg-white/5'}\`}>
              {tab === 'akun' ? \`Akun Staff (\${akunList.length})\` : tab === 'siswa' ? \`Master Siswa (\${siswaList.length})\` : \`Sesi Ujian (\${sesiList.length})\`}
            </button>
          ))}
        </div>

        {/* AKUN TAB */}
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
                    {akunList.map((a, i) => (
                      <tr key={a.id} className={\`border-b border-white/5 hover:bg-white/5 transition-colors \${selectedAkun.has(a.id) ? 'bg-blue-500/10' : ''}\`}>
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
                          <span className={\`px-2 py-1 rounded-lg text-[10px] font-bold tracking-wider \${a.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}\`}>
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
                <button onClick={handleDeleteAkun} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs px-4 py-2 rounded-xl transition-all font-medium">
                  Hapus Terpilih
                </button>
              </div>
            )}
          </div>
        )}

        {/* SISWA TAB */}
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
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Import Excel
                </button>
                <button onClick={() => setShowGenerateModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
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

        {/* SESI TAB */}
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
                      const sisaTxt = isExpired ? 'Expired' : \`\${diffMin}mnt\`;

                      return (
                        <tr key={s.token} className={\`border-b border-white/5 hover:bg-white/5 transition-colors \${selectedSesi.has(s.token) ? 'bg-blue-500/10' : ''}\`}>
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
                            <span className={\`px-2 py-1 rounded-lg font-semibold tracking-wide border \${isExpired ? 'bg-red-500/10 text-red-400 border-red-500/30' : diffMin < 30 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}\`}>
                              {sisaTxt}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button onClick={() => {
                              setEditingSesi(s);
                              setEditSesiForm({
                                token: s.token, nama: s.nama, kelas: s.kelas, noAbsen: s.noAbsen,
                                deadline: new Date(s.deadline).toISOString().slice(0, 16)
                              });
                            }} className="bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg transition-colors border border-white/10">Edit</button>
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
                <button onClick={handleDeleteSesi} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs px-4 py-2 rounded-xl transition-all font-medium">
                  Hapus Terpilih
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Buat Akun */}
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

      {/* Modal Edit Sesi */}
      {editingSesi && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setEditingSesi(null); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden p-8 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white mb-6 text-glow">Edit Sesi: <span className="text-cyan-400 font-mono text-xl">{editingSesi.token}</span></h2>
            {editSesiError && <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl mb-4 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {editSesiError}
            </div>}
            <form onSubmit={handleSaveSesi} className="space-y-4">
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
      
      {/* CSV Preview Modal */}
      {showCsvPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-modalIn"
          onClick={e => { if (e.target === e.currentTarget) setShowCsvPreview(false); }}>
          <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
            <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center shrink-0 relative z-10 bg-white/5">
              <div>
                <h3 className="text-xl font-bold text-white text-glow">Preview Data CSV</h3>
                <p className="text-[11px] text-white/50 mt-1">{csvPreviewData.length} baris ditemukan</p>
              </div>
              <button onClick={() => setShowCsvPreview(false)} className="text-white/30 hover:text-white bg-white/5 hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition-all">✕</button>
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
                      <tr key={i} className={\`border-b border-white/5 \${valid ? 'hover:bg-white/5' : 'bg-red-500/5'}\`}>
                        <td className="px-4 py-3 font-mono text-xs text-white/30">{i + 1}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium">{row.nama || <span className="text-red-400/60 text-[11px]">kosong</span>}</td>
                        <td className="px-4 py-3 text-xs text-white/60">{row.kelas || '—'}</td>
                        <td className="px-4 py-3 text-xs text-white/60">{row.noabsen || '—'}</td>
                        <td className="px-4 py-3 text-xs text-cyan-300 font-mono tracking-wider">{row.ujianid || <span className="text-red-400/60">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-white/40">{row.deadline || <span className="text-amber-400/60">—</span>}</td>
                        <td className="px-4 py-3">
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

      {/* Modals from other components */}
      {showImportModal && <ImportSiswaModal onClose={() => setShowImportModal(false)} onImported={() => { fetchSiswa(); }} />}
      {showGenerateModal && <GenerateSesiModal onClose={() => setShowGenerateModal(false)} onGenerated={() => { fetchSesi(); }} />}
    </div>
  );
\`;

fs.writeFileSync('src/pages/DashboardPage.tsx', beforeReturn + newReturn + '\n}\n');
console.log("Updated DashboardPage.tsx");
