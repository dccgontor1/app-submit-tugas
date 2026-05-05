const fs = require('fs');
let c = fs.readFileSync('client/src/pages/UjianAdminPage.tsx', 'utf8');

const corrupt1 = `                  </div>    );\n                    })\n                  </div>`;
c = c.replace(corrupt1, `                  </div>`);

const idx = c.indexOf('{/* SELESAI */}');
if (idx !== -1) {
    const endIdx = c.indexOf('</main>', idx);
    if (endIdx !== -1) {
        const replacement = `{/* SELESAI */}
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
      `;
        c = c.substring(0, idx) + replacement + c.substring(endIdx);
    }
}

fs.writeFileSync('client/src/pages/UjianAdminPage.tsx', c, 'utf8');
console.log('Fixed syntax and SELESAI part');
