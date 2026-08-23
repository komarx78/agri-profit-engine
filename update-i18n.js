const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'src/lib/i18n.ts');
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

// TRANSLATIONS にポータル用の語彙を追加
const portalWords = `  portalName: { ja: 'Portal', en: 'Portal', vi: 'Portal', id: 'Portal', zh: 'Portal', si: 'Portal', km: 'Portal' },
  adminMode: { ja: '管理者モード', en: 'Admin Mode', vi: 'Chế độ quản trị', id: 'Mode Admin', zh: '管理员模式', si: 'පරිපාලක ප්‍රකාරය', km: 'របៀបអ្នកគ្រប់គ្រង' },
  workerMode: { ja: '現場スタッフモード', en: 'Worker Mode', vi: 'Chế độ nhân viên', id: 'Mode Pekerja', zh: '员工模式', si: 'සේවක ප්‍රකාරය', km: 'របៀបបុគ្គលិក' },
  logout: { ja: 'ログアウト', en: 'Logout', vi: 'Đăng xuất', id: 'Keluar', zh: '登出', si: 'ඉවත් වන්න', km: 'ចាកចេញ' },
  attendancePortal: { ja: '出退勤・現場ポータル', en: 'Attendance & Portal', vi: 'Chấm công & Cổng thông tin', id: 'Kehadiran & Portal', zh: '考勤与门户', si: 'පැමිණීම සහ ද්වාරය', km: 'វត្តមាន និង ច្រក' },
  clockIn: { ja: '出勤する', en: 'Clock In', vi: 'Vào làm', id: 'Masuk Kerja', zh: '上班打卡', si: 'වැඩට පැමිණීම', km: 'ចូលធ្វើការ' },
  clockOut: { ja: '退勤する', en: 'Clock Out', vi: 'Tan làm', id: 'Pulang Kerja', zh: '下班打卡', si: 'වැඩ අවසන්', km: 'ចេញធ្វើការ' },
  goToWorkPortal: { ja: '現場ポータル画面へ', en: 'Go to Worker Portal', vi: 'Đi tới cổng thông tin nhân viên', id: 'Ke Portal Pekerja', zh: '前往员工门户', si: 'සේවක ද්වාරය වෙත යන්න', km: 'ទៅកាន់ច្រកបុគ្គលិក' },
  manualVideo: { ja: 'マニュアル・動画', en: 'Manual & Video', vi: 'Hướng dẫn & Video', id: 'Manual & Video', zh: '手册与视频', si: 'අත්පොත සහ වීඩියෝ', km: 'សៀវភៅណែនាំ & វីដេអូ' },
  watchVideo: { ja: '使い方動画を見る', en: 'Watch Tutorial', vi: 'Xem video hướng dẫn', id: 'Tonton Tutorial', zh: '观看教程', si: 'නිබන්ධනය නරඹන්න', km: 'មើលវីដេអូណែនាំ' },
  approvalInbox: { ja: '承認インボックス', en: 'Approval Inbox', vi: 'Hộp thư phê duyệt', id: 'Kotak Masuk Persetujuan', zh: '审批收件箱', si: 'අනුමත කිරීමේ එන ලිපි', km: 'ប្រអប់សំបុត្រអនុម័ត' },
  seeAll: { ja: 'すべて見る', en: 'See All', vi: 'Xem tất cả', id: 'Lihat Semua', zh: '查看全部', si: 'සියල්ල බලන්න', km: 'មើលទាំងអស់' },
  noticeBoard: { ja: '社内掲示板', en: 'Notice Board', vi: 'Bảng thông báo', id: 'Papan Pengumuman', zh: '公告板', si: 'දැන්වීම් පුවරුව', km: 'ក្តារជូនដំណឹង' },
  seeBoard: { ja: '掲示板を見る・投稿する', en: 'View/Post Notice', vi: 'Xem/Đăng thông báo', id: 'Lihat/Posting Pengumuman', zh: '查看/发布公告', si: 'දැන්වීම් බලන්න/පළ කරන්න', km: 'មើល/បង្ហោះសេចក្តីជូនដំណឹង' },
  scheduleTasks: { ja: 'スケジュール・タスク', en: 'Schedule & Tasks', vi: 'Lịch trình & Nhiệm vụ', id: 'Jadwal & Tugas', zh: '日程与任务', si: 'කාලසටහන සහ කාර්යයන්', km: 'កាលវិភាគ និង ការងារ' },
  createTask: { ja: '+ タスクを作成', en: '+ Create Task', vi: '+ Tạo nhiệm vụ', id: '+ Buat Tugas', zh: '+ 创建任务', si: '+ කාර්යය සාදන්න', km: '+ បង្កើតការងារ' },
  noTasksRecent: { ja: '直近の予定はありません', en: 'No upcoming tasks', vi: 'Không có nhiệm vụ sắp tới', id: 'Tidak ada tugas yang akan datang', zh: '近期没有任务', si: 'ඉදිරි කාර්යයන් නොමැත', km: 'មិនមានការងារបន្ទាប់ទេ' },
  today: { ja: '今日', en: 'Today', vi: 'Hôm nay', id: 'Hari ini', zh: '今天', si: 'අද', km: 'ថ្ងៃនេះ' },`;

i18nContent = i18nContent.replace(/export const TRANSLATIONS: Record<string, Record<string, string>> = \{/, `export const TRANSLATIONS: Record<string, Record<string, string>> = {\n${portalWords}`);

fs.writeFileSync(i18nPath, i18nContent, 'utf8');
console.log('Successfully added portal translations to i18n.ts');
