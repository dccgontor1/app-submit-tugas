const fs = require('fs');
let c = fs.readFileSync('client/src/pages/UjianAdminPage.tsx', 'utf8');

c = c.replace('                  </div>    );\n                    })\n                  </div>', '                  </div>');
c = c.replace(/A\\?\"A\?/g, '●');
c = c.replace(/A\,\A/g, '·');
c = c.replace(/A\?\?T/g, '→');
c = c.replace(/A\"\?o/g, '✓');
c = c.replace(/A\?\"A /g, '▶');
c = c.replace(/A\,\\?\?/g, '—');
c = c.replace(/A A/g, '⏰');

fs.writeFileSync('client/src/pages/UjianAdminPage.tsx', c, 'utf8');
console.log('Fixed');
