const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/tasks/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// insertData に duration_minutes: 0 を追加
content = content.replace(
  /status: 'planned',/,
  "status: 'planned',\n        duration_minutes: 0,"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added duration_minutes to tasks insert');
