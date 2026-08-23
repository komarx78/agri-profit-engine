const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/CalendarWrapper.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// バッククォートのエスケープを外す
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\`/g, '`');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed CalendarWrapper template literals');
