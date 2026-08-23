const fs = require('fs');
const path = require('path');

// 1. CalendarWrapper の修正
let filePath = path.join(__dirname, 'src/components/CalendarWrapper.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /interface CalendarProps \{/,
  `interface CalendarProps {
  t: (key: string) => string;
  language: string;`
);

content = content.replace(
  /export default function CalendarWrapper\(\{ events \}: CalendarProps\) \{/,
  "export default function CalendarWrapper({ events, t, language }: CalendarProps) {"
);

// 曜日
content = content.replace(
  /\['日', '月', '火', '水', '木', '金', '土'\]/g,
  "(language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : language === 'vi' ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] : ['日', '月', '火', '水', '木', '金', '土'])"
);

// 直近のタスク・予定
content = content.replace(
  /<h3 className="text-lg font-black text-slate-800">直近のタスク・予定<\/h3>/,
  '<h3 className="text-lg font-black text-slate-800">{t("recentTasks")}</h3>'
);

// 直近の予定はありません
content = content.replace(
  /<p className="text-slate-400 font-bold">直近の予定はありません<\/p>/,
  '<p className="text-slate-400 font-bold">{t("noTasks")}</p>'
);

// 今日
content = content.replace(
  /isToday \? '今日' : event\.date/g,
  "isToday ? t('today') : event.date"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('CalendarWrapper fixed');

// 2. portal/page.tsx の修正
filePath = path.join(__dirname, 'src/app/portal/page.tsx');
content = fs.readFileSync(filePath, 'utf8');

// usersから company_name (またはname) を取得する状態を追加
content = content.replace(
  /const \[role, setRole\] = useState<'admin' \| 'worker'>\('worker'\);/,
  "const [role, setRole] = useState<'admin' | 'worker'>('worker');\n  const [companyName, setCompanyName] = useState<string>('会社名');"
);

// init()内でcompanyNameをセット
content = content.replace(
  /if \(userData && userData\.role === 'admin'\) \{/,
  "if (userData && userData.name) setCompanyName(userData.name);\n        if (userData && userData.role === 'admin') {"
);

// 辞書に追加
content = content.replace(
  /portalName: \{ ja: '会社名 Portal', en: 'Company Portal', vi: 'Cổng thông tin công ty' \},/,
  "portalName: { ja: `${companyName} Portal`, en: `${companyName} Portal`, vi: `${companyName} Portal` },\n      recentTasks: { ja: '直近のタスク・予定', en: 'Recent Tasks', vi: 'Nhiệm vụ gần đây' },\n      noTasks: { ja: '直近の予定はありません', en: 'No upcoming tasks', vi: 'Không có nhiệm vụ sắp tới' },\n      today: { ja: '今日', en: 'Today', vi: 'Hôm nay' },"
);

// CalendarWrapper の呼び出しを修正
content = content.replace(
  /<CalendarWrapper events=\{calendarEvents\} \/>/,
  "<CalendarWrapper events={calendarEvents} t={t} language={language} />"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Portal page fixed');
