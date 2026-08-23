const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// バッククォートのエスケープを外す
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\`/g, '`');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed portal template literals');
