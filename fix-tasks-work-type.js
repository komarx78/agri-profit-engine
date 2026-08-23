const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/tasks/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// insertData に work_type を追加
content = content.replace(
  /task_title: formData\.task_title,/,
  "task_title: formData.task_title,\n        work_type: formData.task_title," // work_type にも同じ内容を入れる（必須カラム対策）
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added work_type to tasks insert');
