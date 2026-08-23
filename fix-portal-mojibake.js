const fs = require('fs');

let code = fs.readFileSync('src/app/portal/page.tsx', 'utf8');

const lines = code.split('\n');

// 1. getJSTDate function (Line 14-17)
// Remove lines 14-17 and insert correct getJSTDate
lines.splice(13, 4, 
  "const getJSTDate = () => {",
  "  const d = new Date();",
  "  d.setHours(d.getHours() + 9);",
  "  return d.toISOString().split('T')[0];",
  "};",
  "const getJSTTime = () => {",
  "  const d = new Date();",
  "  d.setHours(d.getHours() + 9);",
  "  return d.toISOString().split('T')[1].substring(0, 5);",
  "};"
);

// We need to re-join and find the exact bad lines because splicing changed indices
code = lines.join('\n');

code = code.replace(
  /const \[companyName, setCompanyName\] = useState<string>\('.*?'\);/,
  "const [companyName, setCompanyName] = useState<string>('会社名');"
);

code = code.replace(
  /alert\('([^']+)'\);\s+return;\s+\}/,
  "alert('打刻エラー: あなたのアカウントは現場スタッフとして「スタッフマスタ」に登録されていません。\\n管理画面からご自身をスタッフ登録してください。');\n      return;\n    }"
);

code = code.replace(
  /console\.error\('.*?', err\);\s+alert\('.*?'\);/,
  "console.error('打刻エラー:', err);\n      alert('打刻に失敗しました。');"
);

code = code.replace(
  /title: t\.task_title \|\| '.*?'/,
  "title: t.task_title || '作業'"
);

// Other mojibake comments
code = code.replace(/\/\/ 郢ｧ・ｿ郢ｧ・ｹ郢ｧ・ｯ.*/, "// 1. タスク (カレンダー用)");
code = code.replace(/const targetUserId = profile \? profile\.user_id : userId; \/\/.*/, "const targetUserId = profile ? profile.user_id : userId; // オーナーID");
code = code.replace(/\/\/ 2\. 隰・ｽｿ髫ｱ讎奇ｽｾ.*/, "// 2. 承認待ち (管理者の場合はテナントの全員)");
code = code.replace(/\/\/ 3\. 隰暦ｽｲ驕会ｽｺ陇夲ｽｿ陇崢€陇・ｽｰ3闔会ｽｶ/, "// 3. 掲示板最新3件");
code = code.replace(/\/\/ 4\. 闔蛾大ｾ狗ｸｺ・ｮ隰・§邯ｾ霑･・ｶ隲ｷ繝ｻ    const workerId = profile \? profile\.id : userId; \/\/.*/, "// 4. 今日の打刻状態\n    const workerId = profile ? profile.id : userId;");
code = code.replace(/\/\/ 陷・ｽｺ鬨ｾﾂ€陷搾ｽ､郢ｧ・｢郢ｧ・ｯ郢ｧ・ｷ郢晢ｽｧ郢晢ｽｳ/, "// 出退勤アクション");
code = code.replace(/\/\/ workerProfile\.id \(UUID of workers table\) 邵ｺ謔滂ｽｿ繝ｻ・ｰ繝ｻ    if \(!workerProfile \|\| !workerProfile\.id\) \{/, "// workerProfile.id (UUID of workers table) が必要\n    if (!workerProfile || !workerProfile.id) {");
code = code.replace(/<span className="text-2xl">﨟樒ｴ\・\/span>/, '<span className="text-2xl">🏃‍♂️</span>');
code = code.replace(/<span className="text-2xl">﨟槫権<\/span>/, '<span className="text-2xl">🏠</span>');

fs.writeFileSync('src/app/portal/page.tsx', code, 'utf8');
console.log('Fixed all mojibake!');
