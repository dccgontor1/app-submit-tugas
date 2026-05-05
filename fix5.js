const fs = require('fs');
let c = fs.readFileSync('client/src/pages/UjianAdminPage.tsx', 'utf8');

c = c.replace(/<\/div>\s*<\/div>\s*\);\s*\}\)}\s*<\/div>/g, '</div>\n                      );\n                    })}\n                  </div>');

// Ensure that we don't have multiple `</div>` unmatched
const idx = c.indexOf('                  </div>    );');
if (idx !== -1) {
    const end = c.indexOf('                  </div>', idx + 10);
    c = c.substring(0, idx) + '                      );\n                    })}\n                  </div>' + c.substring(end + 24);
}

// Clean up weird text-white/20 font-mono
c = c.replace(/font-mono/g, 'font-mono');

fs.writeFileSync('client/src/pages/UjianAdminPage.tsx', c, 'utf8');
console.log('Fixed');
