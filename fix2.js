const fs = require('fs');
let c = fs.readFileSync('client/src/pages/UjianAdminPage.tsx', 'utf8');

const target = 'transition-all">';
const startIdx = c.indexOf(target, c.indexOf('fetchMonitor'));
if (startIdx !== -1) {
    const endIdx = c.indexOf('<div className="space-y-4">', startIdx);
    if (endIdx !== -1) {
        c = c.substring(0, startIdx + target.length) + 'Refresh</button>\n                  </div>\n                  ' + c.substring(endIdx);
    }
}

fs.writeFileSync('client/src/pages/UjianAdminPage.tsx', c, 'utf8');
console.log('Fixed button');
