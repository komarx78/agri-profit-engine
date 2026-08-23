const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// インポートの追加
content = content.replace(
  /import dynamic from 'next\/dynamic';/,
  "import dynamic from 'next/dynamic';\nimport { t, LANGUAGES, LanguageCode } from '@/lib/i18n';"
);

// Stateの型と辞書の削除
content = content.replace(
  /const \[language, setLanguage\] = useState<'ja' \| 'en' \| 'vi'>\('ja'\);/,
  "const [language, setLanguage] = useState<LanguageCode>('ja');"
);
content = content.replace(/const t = \([\s\S]*?\}\;/g, '');

// セレクトボックスの修正
const selectBox = `
              <select 
                value={language}
                onChange={(e: any) => setLanguage(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
                ))}
              </select>
`;
content = content.replace(/<select[\s\S]*?<\/select>/, selectBox.trim());

// t() の引数を修正
content = content.replace(/\{t\('adminMode'\)\}/g, "{t('adminMode', language)}");
content = content.replace(/\{t\('workerMode'\)\}/g, "{t('workerMode', language)}");
content = content.replace(/\{t\('logout'\)\}/g, "{t('logout', language)}");
content = content.replace(/\{t\('attendance'\)\}/g, "{t('attendancePortal', language)}");
content = content.replace(/\{t\('clockIn'\)\}/g, "{t('clockIn', language)}");
content = content.replace(/\{t\('clockOut'\)\}/g, "{t('clockOut', language)}");
content = content.replace(/\{t\('goToWorkPortal'\)\}/g, "{t('goToWorkPortal', language)}");
content = content.replace(/\{t\('manual'\)\}/g, "{t('manualVideo', language)}");
content = content.replace(/\{t\('watchVideo'\)\}/g, "{t('watchVideo', language)}");
content = content.replace(/\{t\('inbox'\)\}/g, "{t('approvalInbox', language)}");
content = content.replace(/\{t\('seeAll'\)\}/g, "{t('seeAll', language)}");
content = content.replace(/\{t\('board'\)\}/g, "{t('noticeBoard', language)}");
content = content.replace(/\{t\('seeBoard'\)\}/g, "{t('seeBoard', language)}");
content = content.replace(/\{t\('schedule'\)\}/g, "{t('scheduleTasks', language)}");
content = content.replace(/\{t\('createTask'\)\}/g, "{t('createTask', language)}");

// タイトル
content = content.replace(
  /<h1 className="text-xl font-black text-slate-800 tracking-tight">\{t\("portalName"\)\}<\/h1>/,
  '<h1 className="text-xl font-black text-slate-800 tracking-tight">{companyName} {t("portalName", language)}</h1>'
);

// 掲示板のコンテンツ表示
content = content.replace(
  /<p className="font-medium text-slate-700 line-clamp-2">\{post.content\}<\/p>/,
  `<p className="font-medium text-slate-700 line-clamp-2">{(language !== 'ja' && post.translations && post.translations[language]) ? post.translations[language] : post.content}</p>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated portal page to use i18n library');
