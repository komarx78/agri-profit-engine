const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// t関数の残骸を綺麗に消す
content = content.replace(
  /const t = \([\s\S]*?return \(dict as any\)\[key\]\?\u002E\[language\] \|\| key;\n  \};\n/g,
  ""
);

content = content.replace(
  /return \(dict as any\)\[key\]\?\u002E\[language\] \|\| key;\n  \};\n/,
  ""
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully cleaned up old t function');
