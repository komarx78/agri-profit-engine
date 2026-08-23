const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/work/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// タスク表示ロジックの tenant_id を user_id に修正
content = content.replace(
  /\.eq\('tenant_id', currentUser\.tenant_id\)/g,
  ".eq('user_id', currentUser.tenant_id)" // currentUser.tenant_id は元のロジックのままにしておく（恐らくuser_idかfarm_idが入っている）
);

// タイマー終了時と手動入力時に approval_status を追加
// 手動
content = content.replace(
  /video_url: uploadedVideoUrl\s*\}\]\)/,
  "video_url: uploadedVideoUrl,\n          approval_status: 'pending'\n        }])"
);

// タイマー
content = content.replace(
  /status: 'completed',\s*work_date: stopTime\.split\('T'\)\[0\],/,
  "status: 'completed',\n          approval_status: 'pending',\n          work_date: stopTime.split('T')[0],"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed work page');
