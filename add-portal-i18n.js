const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Globe2 のインポートを追加
content = content.replace(
  /PlayCircle\n\} from 'lucide-react';/,
  "PlayCircle, Globe2\n} from 'lucide-react';"
);

// 2. 言語Stateを追加
content = content.replace(
  /const \[role, setRole\] = useState<'admin' \| 'worker'>\('worker'\);/,
  "const [role, setRole] = useState<'admin' | 'worker'>('worker');\n  const [language, setLanguage] = useState<'ja' | 'en' | 'vi'>('ja');"
);

// 3. 翻訳辞書を追加
const dictStr = `
  const t = (key: string) => {
    const dict = {
      portalName: { ja: '会社名 Portal', en: 'Company Portal', vi: 'Cổng thông tin công ty' },
      adminMode: { ja: '管理者モード', en: 'Admin Mode', vi: 'Chế độ quản trị' },
      workerMode: { ja: '現場スタッフモード', en: 'Worker Mode', vi: 'Chế độ nhân viên' },
      logout: { ja: 'ログアウト', en: 'Logout', vi: 'Đăng xuất' },
      attendance: { ja: '出退勤・現場ポータル', en: 'Attendance & Portal', vi: 'Chấm công & Cổng thông tin' },
      clockIn: { ja: '出勤する', en: 'Clock In', vi: 'Vào làm' },
      clockOut: { ja: '退勤する', en: 'Clock Out', vi: 'Tan làm' },
      goToWorkPortal: { ja: '現場ポータル画面へ', en: 'Go to Worker Portal', vi: 'Đi tới cổng thông tin nhân viên' },
      manual: { ja: 'マニュアル・動画', en: 'Manual & Video', vi: 'Hướng dẫn & Video' },
      watchVideo: { ja: '使い方動画を見る', en: 'Watch Tutorial', vi: 'Xem video hướng dẫn' },
      inbox: { ja: '承認インボックス', en: 'Approval Inbox', vi: 'Hộp thư phê duyệt' },
      seeAll: { ja: 'すべて見る', en: 'See All', vi: 'Xem tất cả' },
      board: { ja: '社内掲示板', en: 'Notice Board', vi: 'Bảng thông báo' },
      seeBoard: { ja: '掲示板を見る・投稿する', en: 'View/Post Notice', vi: 'Xem/Đăng thông báo' },
      schedule: { ja: 'スケジュール・タスク', en: 'Schedule & Tasks', vi: 'Lịch trình & Nhiệm vụ' },
      createTask: { ja: '+ タスクを作成', en: '+ Create Task', vi: '+ Tạo nhiệm vụ' },
    };
    return (dict as any)[key]?.[language] || key;
  };
`;
content = content.replace(
  /const hasClockedIn = attendance && attendance\.clock_in;/,
  dictStr + "\n  const hasClockedIn = attendance && attendance.clock_in;"
);

// 4. 言語切り替えセレクタをヘッダーに追加し、タイトルなどを t() で囲む
content = content.replace(
  /<h1 className="text-xl font-black text-slate-800 tracking-tight">会社名 Portal<\/h1>/,
  '<h1 className="text-xl font-black text-slate-800 tracking-tight">{t("portalName")}</h1>'
);
content = content.replace(
  /\{role === 'admin' \? '管理者モード' : '現場スタッフモード'\}/,
  "{role === 'admin' ? t('adminMode') : t('workerMode')}"
);

// ログアウトと並べて言語切り替えを追加
content = content.replace(
  /<button onClick=\{handleLogout\} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">\n\s*<LogOut className="w-4 h-4" \/> ログアウト\n\s*<\/button>/,
  `<div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <Globe2 className="w-4 h-4 text-slate-400" />
              <select 
                value={language}
                onChange={(e: any) => setLanguage(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">
              <LogOut className="w-4 h-4" /> {t('logout')}
            </button>
          </div>`
);

// 他のテキストも置換 (一部抜粋)
content = content.replace(/出退勤・現場ポータル/g, "{t('attendance')}");
content = content.replace(/出勤する/g, "{t('clockIn')}");
content = content.replace(/退勤する/g, "{t('clockOut')}");
content = content.replace(/現場ポータル画面へ/g, "{t('goToWorkPortal')}");
content = content.replace(/マニュアル・動画/g, "{t('manual')}");
content = content.replace(/使い方動画を見る/g, "{t('watchVideo')}");
content = content.replace(/承認インボックス/g, "{t('inbox')}");
content = content.replace(/すべて見る/g, "{t('seeAll')}");
content = content.replace(/社内掲示板/g, "{t('board')}");
content = content.replace(/掲示板を見る・投稿する/g, "{t('seeBoard')}");
content = content.replace(/スケジュール・タスク/g, "{t('schedule')}");
content = content.replace(/\+ タスクを作成/g, "{t('createTask')}");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added translation mode to portal');
