const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/layout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// アイコンのインポート追加
content = content.replace(
  /FlaskConical\n\} from 'lucide-react';/,
  "FlaskConical,\n  CheckSquare,\n  Inbox\n} from 'lucide-react';"
);

// navGroups の変更
// { title: '作業履歴・記録', items: [ { name: '作業記録一覧', path: '/admin/history', icon: History }, ... ] }
const targetGroup = `    {
      title: '作業履歴・記録',
      items: [
        { name: '作業記録一覧', path: '/admin/history', icon: History },
        { name: '作業内容台帳 (集計)', path: '/admin/work-ledger', icon: Table },
      ]
    },`;

const newGroup = `    {
      title: 'タスク・作業記録',
      items: [
        { name: 'タスク・スケジュール', path: '/admin/tasks', icon: CheckSquare },
        { name: '承認インボックス', path: '/admin/approvals', icon: Inbox },
        { name: '作業記録一覧', path: '/admin/history', icon: History },
        { name: '作業内容台帳 (集計)', path: '/admin/work-ledger', icon: Table },
      ]
    },`;

content = content.replace(targetGroup, newGroup);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated admin layout');
