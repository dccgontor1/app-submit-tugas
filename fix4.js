const fs = require('fs');
let c = fs.readFileSync('client/src/pages/UjianAdminPage.tsx', 'utf8');

c = c.replace(/<\/div>\s+\);\s+\}\)}\s+<\/div>/, '</div>\n                  </div>');

// also fix SELESAI block
c = c.replace(/o\"/, '✓');
c = c.replace(/A Lihat hasil/, '· Lihat hasil');
c = c.replace(/\+' Ke Penilaian/, '→ Ke Penilaian');

fs.writeFileSync('client/src/pages/UjianAdminPage.tsx', c, 'utf8');
console.log('Fixed syntax!');
