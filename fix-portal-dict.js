const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 壊れた辞書を再置換
content = content.replace(
  /const dict = \{[\s\S]*?createTask: \{ ja: '\{t\('createTask'\)\}', en: '\+ Create Task', vi: '\+ Tạo nhiệm vụ' \},\n    \};/,
  `const dict = {
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
    };`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed dictionary definition');
