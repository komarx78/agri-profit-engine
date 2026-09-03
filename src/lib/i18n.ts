export type LanguageCode = 'ja' | 'en' | 'vi' | 'id' | 'zh' | 'si' | 'km';

export const LANGUAGES = [
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'si', name: 'සිංහල (Sinhala)', flag: '🇱🇰' },
  { code: 'km', name: 'ភាសាខ្មែរ (Khmer)', flag: '🇰🇭' },
];

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  portalName: { ja: 'Portal', en: 'Portal', vi: 'Portal', id: 'Portal', zh: 'Portal', si: 'Portal', km: 'Portal' },
  adminMode: { ja: '管理者モード', en: 'Admin Mode', vi: 'Chế độ quản trị', id: 'Mode Admin', zh: '管理员模式', si: 'පරිපාලක ප්‍රකාරය', km: 'របៀបអ្នកគ្រប់គ្រង' },
  workerMode: { ja: '現場スタッフモード', en: 'Worker Mode', vi: 'Chế độ nhân viên', id: 'Mode Pekerja', zh: '员工模式', si: 'සේවක ප්‍රකාරය', km: 'របៀបបុគ្គលិក' },
  portal_logout: { ja: 'ログアウト', en: 'Logout', vi: 'Đăng xuất', id: 'Keluar', zh: '登出', si: 'ඉවත් වන්න', km: 'ចាកចេញ' },
  attendancePortal: { ja: '出退勤・現場ポータル', en: 'Attendance & Portal', vi: 'Chấm công & Cổng thông tin', id: 'Kehadiran & Portal', zh: '考勤与门户', si: 'පැමිණීම සහ ද්වාරය', km: 'វត្តមាន និង ច្រក' },
  portal_clockIn: { ja: '出勤する', en: 'Clock In', vi: 'Vào làm', id: 'Masuk Kerja', zh: '上班打卡', si: 'වැඩට පැමිණීම', km: 'ចូលធ្វើការ' },
  portal_clockOut: { ja: '退勤する', en: 'Clock Out', vi: 'Tan làm', id: 'Pulang Kerja', zh: '下班打卡', si: 'වැඩ අවසන්', km: 'ចេញធ្វើការ' },
  goToWorkPortal: { ja: '現場ポータル画面へ', en: 'Go to Worker Portal', vi: 'Đi tới cổng thông tin nhân viên', id: 'Ke Portal Pekerja', zh: '前往员工门户', si: 'සේවක ද්වාරය වෙත යන්න', km: 'ទៅកាន់ច្រកបុគ្គលិក' },
  manualVideo: { ja: 'マニュアル・動画', en: 'Manual & Video', vi: 'Hướng dẫn & Video', id: 'Manual & Video', zh: '手册与视频', si: 'අත්පොත සහ වීඩියෝ', km: 'សៀវភៅណែនាំ & វីដេអូ' },
  watchVideo: { ja: '使い方動画を見る', en: 'Watch Tutorial', vi: 'Xem video hướng dẫn', id: 'Tonton Tutorial', zh: '观看教程', si: 'නිබන්ධනය නරඹන්න', km: 'មើលវីដេអូណែនាំ' },
  approvalInbox: { ja: '承認インボックス', en: 'Approval Inbox', vi: 'Hộp thư phê duyệt', id: 'Kotak Masuk Persetujuan', zh: '审批收件箱', si: 'අනුමත කිරීමේ එන ලිපි', km: 'ប្រអប់សំបុត្រអនុម័ត' },
  seeAll: { ja: 'すべて見る', en: 'See All', vi: 'Xem tất cả', id: 'Lihat Semua', zh: '查看全部', si: 'සියල්ල බලන්න', km: 'មើលទាំងអស់' },
  noticeBoard: { ja: '社内掲示板', en: 'Notice Board', vi: 'Bảng thông báo', id: 'Papan Pengumuman', zh: '公告板', si: 'දැන්වීම් පුවරුව', km: 'ក្តារជូនដំណឹង' },
  seeBoard: { ja: '掲示板を見る・投稿する', en: 'View/Post Notice', vi: 'Xem/Đăng thông báo', id: 'Lihat/Posting Pengumuman', zh: '查看/发布公告', si: 'දැන්වීම් බලන්න/පළ කරන්න', km: 'មើល/បង្ហោះសេចក្តីជូនដំណឹង' },
  board_newPost: { ja: '投稿', en: 'Post', vi: 'Đăng', id: 'Posting', zh: '发帖', si: 'පළ කරන්න', km: 'បង្ហោះ' },
  board_openModal: { ja: '掲示板を開く・投稿する', en: 'Open Board & Post', vi: 'Mở bảng tin & Đăng bài', id: 'Buka Papan & Posting', zh: '打开公告板与发帖', si: 'පුවරුව විවෘත කර පළ කරන්න', km: 'បើកក្តារព័ត៌មាន និង បង្ហោះ' },
  board_modalTitle: { ja: '社内掲示板 & スレッド', en: 'Notice Board & Threads', vi: 'Bảng tin nội bộ & Bình luận', id: 'Papan Pengumuman & Utas', zh: '内部公告栏与讨论', si: 'අභ්‍යන්තර දැන්වීම් සහ සාකච්ඡා', km: 'ក្តារព័ត៌មានផ្ទៃក្នុង និង ការពិភាក្សា' },
  board_modalSub: { ja: 'リアルタイム連絡・多言語自動翻訳', en: 'Real-time updates & AI Auto-translation', vi: 'Cập nhật thời gian thực & Tự động dịch AI', id: 'Pembaruan real-time & Terjemahan otomatis AI', zh: '实时通知与多语言AI自动翻译', si: 'තථ්‍ය කාලීන යාවත්කාලීන සහ ස්වයංක්‍රීය AI පරිවර්තනය', km: 'ការជូនដំណឹងផ្ទាល់ និង ការបកប្រែស្វ័យប្រវត្តិ AI' },
  board_backToPortal: { ja: 'ポータルへ戻る', en: 'Back to Portal', vi: 'Quay lại Portal', id: 'Kembali ke Portal', zh: '返回门户', si: 'ද්වාරය වෙත ආපසු', km: 'ត្រឡប់ទៅផតថល' },
  board_newPostTitle: { ja: '新しいお知らせを投稿（全スタッフの母国語へAI自動翻訳）', en: 'New Announcement (AI Auto-translated)', vi: 'Đăng thông báo mới (AI tự động dịch)', id: 'Posting Pengumuman Baru (Terjemahan AI)', zh: '发布新公告（AI多语言自动翻译）', si: 'නව නිවේදනයක් පළ කරන්න (AI පරිවර්තනය)', km: 'បង្ហោះសេចក្តីជូនដំណឹងថ្មី (បកប្រែដោយ AI)' },
  board_categoryLabel: { ja: 'カテゴリ:', en: 'Category:', vi: 'Danh mục:', id: 'Kategori:', zh: '类别:', si: 'ප්‍රවර්ගය:', km: 'ប្រភេទ:' },
  board_catLife: { ja: '🛒 生活・買い物・特売', en: '🛒 Daily / Shopping / Sales', vi: '🛒 Đời sống / Mua sắm', id: '🛒 Kehidupan / Belanja', zh: '🛒 生活 / 购物 / 特价', si: '🛒 ජීවිතය / සාප්පු සවාරි', km: '🛒 ការរស់នៅ / ទិញទំនិញ' },
  board_catWork: { ja: '🚜 仕事・業務連絡', en: '🚜 Work / Operations', vi: '🚜 Công việc / Thông báo', id: '🚜 Pekerjaan / Operasional', zh: '🚜 工作 / 业务通知', si: '🚜 වැඩ / මෙහෙයුම්', km: '🚜 ការងារ / សេចក្តីជូនដំណឹង' },
  board_catGeneral: { ja: '💬 雑談・その他', en: '💬 General / Others', vi: '💬 Trò chuyện / Khác', id: '💬 Obrolan / Lainnya', zh: '💬 闲聊 / 其他', si: '💬 සාමාන්‍ය / වෙනත්', km: '💬 ការសន្ទនា / ផ្សេងៗ' },
  board_placeholder: { ja: 'スタッフ全員にお知らせしたい内容を入力してください... (例: マツヤスーパーでイチゴが特売だよ！ / 明日は雨天のため長靴を持参してください)', en: 'Enter message for all staff... (e.g. Strawberries on sale at Matsuya! / Please bring rain boots tomorrow)', vi: 'Nhập nội dung muốn thông báo cho tất cả nhân viên...', id: 'Masukkan pesan untuk semua staf...', zh: '请输入想通知全体员工的内容...', si: 'සියලු කාර්ය මණ්ඩලයට දැනුම් දීමට අවශ්‍ය දේ ඇතුළත් කරන්න...', km: 'បញ្ចូលព័ត៌មានដែលចង់ជូនដំណឹងដល់បុគ្គលិកទាំងអស់...' },
  board_author: { ja: '投稿者:', en: 'Author:', vi: 'Người đăng:', id: 'Penulis:', zh: '发布者:', si: 'කර්තෘ:', km: 'អ្នកបង្ហោះ:' },
  board_postBtn: { ja: '投稿する', en: 'Post', vi: 'Đăng bài', id: 'Posting', zh: '发布', si: 'පළ කරන්න', km: 'បង្ហោះ' },
  board_filterAll: { ja: 'すべて', en: 'All', vi: 'Tất cả', id: 'Semua', zh: '全部', si: 'සියල්ල', km: 'ទាំងអស់' },
  board_noPosts: { ja: '該当するお知らせはありません', en: 'No announcements found', vi: 'Không có thông báo nào', id: 'Tidak ada pengumuman', zh: '没有相关公告', si: 'අදාළ නිවේදන නොමැත', km: 'មិនមានសេចក្តីជូនដំណឹងទេ' },
  board_replyPlaceholder: { ja: '返信を入力... (例: 了解しました！ / 私も行きます)', en: 'Write a reply... (e.g. Understood! / Count me in)', vi: 'Nhập phản hồi... (vd: Đã rõ! / Tôi cũng tham gia)', id: 'Tulis balasan... (cth: Dimengerti! / Saya ikut)', zh: '输入回复... (例: 收到！ / 我也去)', si: 'පිළිතුරක් ඇතුළත් කරන්න...', km: 'បញ្ចូលការឆ្លើយតប...' },
  board_replyBtn: { ja: '返信', en: 'Reply', vi: 'Gửi', id: 'Balas', zh: '回复', si: 'පිළිතුරු', km: 'ឆ្លើយតប' },
  board_totalCount: { ja: '全 {count} 件', en: 'Total {count}', vi: 'Tổng {count}', id: 'Total {count}', zh: '共 {count} 条', si: 'සමස්ත {count}', km: 'សរុប {count}' },
  scheduleTasks: { ja: 'スケジュール・タスク', en: 'Schedule & Tasks', vi: 'Lịch trình & Nhiệm vụ', id: 'Jadwal & Tugas', zh: '日程与任务', si: 'කාලසටහන සහ කාර්යයන්', km: 'កាលវិភាគ និង ការងារ' },
  createTask: { ja: '+ タスクを作成', en: '+ Create Task', vi: '+ Tạo nhiệm vụ', id: '+ Buat Tugas', zh: '+ 创建任务', si: '+ කාර්යය සාදන්න', km: '+ បង្កើតការងារ' },
  noTasksRecent: { ja: '直近の予定はありません', en: 'No upcoming tasks', vi: 'Không có nhiệm vụ sắp tới', id: 'Tidak ada tugas yang akan datang', zh: '近期没有任务', si: 'ඉදිරි කාර්යයන් නොමැත', km: 'មិនមានការងារបន្ទាប់ទេ' },
  portal_today: { ja: '今日', en: 'Today', vi: 'Hôm nay', id: 'Hari ini', zh: '今天', si: 'අද', km: 'ថ្ងៃនេះ' },
  portal_recentTasks: { ja: '直近のタスク・予定', en: 'Recent Tasks', vi: 'Nhiệm vụ gần đây', id: 'Tugas Terbaru', zh: '近期任务', si: 'මෑත කාලීන කාර්යයන්', km: 'ការងារថ្មីៗ' },
  portal_loggedIn: { ja: 'ログイン中: ', en: 'Logged in: ', vi: 'Đang đăng nhập: ', id: 'Masuk sebagai: ', zh: '登录中: ', si: 'ඇතුල් වී ඇත: ', km: 'បានចូល: ' },
  switchWorker: { ja: 'スタッフ切替', en: 'Switch Staff', vi: 'Đổi nhân viên', id: 'Ganti Staf', zh: '切换员工', si: 'කාර්ය මණ්ඩලය මාරු කරන්න', km: 'ប្តូរបុគ្គលិក' },
  currentWorkerLabel: { ja: '現在の作業者', en: 'Current Worker', vi: 'Người làm hiện tại', id: 'Pekerja Saat Ini', zh: '当前作业人员', si: 'වත්මන් සේවකයා', km: 'បុគ្គលិកបច្ចុប្បន្ន' },
  workerHonorific: { ja: 'さん', en: '', vi: '', id: '', zh: ' 先生/女士', si: '', km: '' },
  leave_title: { ja: '有給休暇・残日数', en: 'Paid Leave & Remaining Days', vi: 'Nghỉ phép có lương & Số ngày còn', id: 'Cuti Berbayar & Sisa Hari', zh: '带薪休假与剩余天数', si: 'වැටුප් සහිත නිවාඩු සහ ඉතිරි දින', km: 'ការឈប់សម្រាកមានប្រាក់ខែ និង ថ្ងៃនៅសល់' },
  leave_applyBtn: { ja: '+ 有給を申請', en: '+ Request Leave', vi: '+ Xin nghỉ phép', id: '+ Ajukan Cuti', zh: '+ 申请带薪假', si: '+ නිවාඩු ඉල්ලන්න', km: '+ ស្នើសុំឈប់សម្រាក' },
  leave_availableDays: { ja: '現在の利用可能残日数', en: 'Currently Available Days', vi: 'Số ngày phép khả dụng hiện tại', id: 'Sisa Hari yang Tersedia', zh: '当前可用剩余天数', si: 'දැනට ලබා ගත හැකි දින ගණන', km: 'ចំនួនថ្ងៃដែលអាចប្រើបានបច្ចុប្បន្ន' },
  daysUnit: { ja: '日', en: ' days', vi: ' ngày', id: ' hari', zh: ' 天', si: ' දින', km: ' ថ្ងៃ' },
  leave_carriedOver: { ja: '繰越: ', en: 'Carried over: ', vi: 'Chuyển tiếp: ', id: 'Bawaan: ', zh: '结转: ', si: 'පෙර වසරෙන්: ', km: 'ផ្ទេរមកពីមុន: ' },
  leave_grantedThisYear: { ja: '今年度付与: ', en: 'Granted this year: ', vi: 'Cấp năm nay: ', id: 'Diberikan tahun ini: ', zh: '本年度赋予: ', si: 'මෙම වසරේ ලබා දී ඇත: ', km: 'ផ្តល់ក្នុងឆ្នាំនេះ: ' },
  cal_allEvents: { ja: '全員の予定', en: 'All Schedule', vi: 'Lịch toàn bộ', id: 'Jadwal Semua', zh: '全体日程', si: 'සියලු දෙනාගේ කාලසටහන', km: 'កាលវិភាគទាំងអស់' },
  cal_myTasksOnly: { ja: '担当タスクのみ', en: 'My Tasks Only', vi: 'Nhiệm vụ của tôi', id: 'Tugas Saya Saja', zh: '仅我的任务', si: 'මගේ කාර්යයන් පමණි', km: 'ការងាររបស់ខ្ញុំប៉ុណ្ណោះ' },
  cal_targetWorker: { ja: '担当者表示:', en: 'Assignee:', vi: 'Hiển thị theo nhân viên:', id: 'Penanggung Jawab:', zh: '按负责人显示:', si: 'වගකිවයුතු පුද්ගලයා:', km: 'បង្ហាញតាមបុគ្គលិក:' },
  cal_allStaffOption: { ja: '（未選択・全員対象）', en: '(All Staff)', vi: '(Tất cả nhân viên)', id: '(Semua Staf)', zh: '(全员)', si: '(සියලු කාර්ය මණ්ඩලය)', km: '(បុគ្គលិកទាំងអស់)' },
  cal_highlighting: { ja: 'をハイライト中', en: ' highlighted', vi: ' đang được làm nổi bật', id: ' disorot', zh: ' 高亮中', si: ' උද්දීපනය කර ඇත', km: ' កំពុងរំលេច' },
  cal_you: { ja: 'あなた', en: 'You', vi: 'Bạn', id: 'Anda', zh: '你', si: 'ඔබ', km: 'អ្នក' },
  cal_meTag: { ja: '(自分)', en: '(You)', vi: '(Bạn)', id: '(Anda)', zh: '(自己)', si: '(ඔබ)', km: '(ខ្លួនឯង)' },
  
  // マニュアル・動画ガイドモーダル
  manual_backToPortal: { ja: 'ポータルへ戻る', en: 'Back to Portal', vi: 'Quay lại Portal', id: 'Kembali ke Portal', zh: '返回门户', si: 'ද්වාරය වෙත ආපසු', km: 'ត្រឡប់ទៅផតថល' },
  manual_modalTitle: { ja: 'マニュアル・動画ガイド', en: 'Manual & Video Guide', vi: 'Hướng dẫn sử dụng & Video', id: 'Panduan Manual & Video', zh: '操作手册与视频指南', si: 'අත්පොත සහ වීඩියෝ මාර්ගෝපදේශය', km: 'សៀវភៅណែនាំ និង វីដេអូណែនាំ' },
  manual_modalSub: { ja: '操作手順と解説動画を1つの画面で確認できます', en: 'Check procedures and tutorial videos in one screen', vi: 'Xem hướng dẫn và video trên một màn hình', id: 'Periksa langkah dan video dalam satu layar', zh: '在同一屏幕上查看操作步骤和讲解视频', si: 'එක් තිරයකින් පියවර සහ වීඩියෝ බලන්න', km: 'ពិនិត្យមើលជំហាន និង វីដេអូនៅលើអេក្រង់តែមួយ' },
  manual_tabVideo: { ja: '動画マニュアル', en: 'Video Tutorials', vi: 'Video hướng dẫn', id: 'Video Tutorial', zh: '视频教程', si: 'වීඩියෝ නිබන්ධන', km: 'វីដេអូណែនាំ' },
  manual_tabGuide: { ja: 'スタートガイド', en: 'Getting Started', vi: 'Hướng dẫn bắt đầu', id: 'Panduan Memulai', zh: '入门指南', si: 'ආරම්භක මාර්ගෝපදේශය', km: 'ការចាប់ផ្តើម' },
  manual_movieTutorialsTag: { ja: 'MOVIE TUTORIALS', en: 'MOVIE TUTORIALS', vi: 'VIDEO HƯỚNG DẪN', id: 'TUTORIAL VIDEO', zh: '视频教程', si: 'වීඩියෝ නිබන්ධන', km: 'វីដេអូណែនាំ' },
  manual_videoHeading: { ja: 'システム使い方動画集', en: 'System Tutorial Videos', vi: 'Tuyển tập video hướng dẫn hệ thống', id: 'Kumpulan Video Tutorial Sistem', zh: '系统使用方法视频集', si: 'පද්ධති භාවිත වීඩියෝ එකතුව', km: 'បណ្តុំវីដេអូណែនាំការប្រើប្រាស់ប្រព័ន្ធ' },
  manual_videoDesc: { ja: '現場での操作方法や初期設定の流れをわかりやすく動画で解説します。見たい動画をクリックして再生してください。', en: 'Clear video explanations of field operations and initial setup. Click any video to play.', vi: 'Video giải thích rõ ràng các thao tác tại hiện trường và cài đặt ban đầu. Nhấn vào video để phát.', id: 'Penjelasan video tentang operasi lapangan dan pengaturan awal. Klik video untuk memutar.', zh: '通过视频清晰讲解现场操作和初始设置流程。点击即可播放。', si: 'ක්ෂේත්‍ර මෙහෙයුම් සහ මූලික සැකසුම් පැහැදිලි කෙරෙන වීඩියෝ. වාදනය කිරීමට ක්ලික් කරන්න.', km: 'ការពន្យល់វីដេអូអំពីប្រតិបត្តិការ និង ការកំណត់ដំបូង។ ចុចដើម្បីចាក់។' },
  manual_addNewVideo: { ja: '新規動画を登録', en: 'Add New Video', vi: 'Thêm video mới', id: 'Tambah Video Baru', zh: '添加新视频', si: 'නව වීඩියෝවක් එක් කරන්න', km: 'បន្ថែមវីដេអូថ្មី' },
  manual_playingNow: { ja: '動画を再生中（多言語テロップ連動）', en: 'Playing Video (with Subtitles)', vi: 'Đang phát video (kèm phụ đề)', id: 'Memutar Video (dengan Subtitle)', zh: '正在播放视频（多语言字幕同步）', si: 'වීඩියෝව වාදනය වේ', km: 'កំពុងចាក់វីដេអូ' },
  manual_closePlayer: { ja: 'プレイヤーを閉じる', en: 'Close Player', vi: 'Đóng trình phát', id: 'Tutup Pemutar', zh: '关闭播放器', si: 'වසා දමන්න', km: 'បិទកម្មវិធីចាក់' },
  manual_subtitleLang: { ja: '字幕言語:', en: 'Subtitles:', vi: 'Ngôn ngữ phụ đề:', id: 'Subtitle:', zh: '字幕语言:', si: 'උපසිරැසි:', km: 'ភាសាអក្សររត់:' },
  manual_noVideosTitle: { ja: '現在、登録されている解説動画はありません', en: 'No tutorial videos currently registered', vi: 'Hiện chưa có video hướng dẫn nào', id: 'Belum ada video tutorial yang terdaftar', zh: '目前没有已注册的教学视频', si: 'දැනට ලියාපදිංචි වීඩියෝ නොමැත', km: 'មិនទាន់មានវីដេអូណែនាំនៅឡើយទេ' },
  manual_noVideosDesc: { ja: 'ステップごとの詳しい操作手順は「スタートガイド」タブから画像付きでご確認いただけます。', en: 'You can check detailed step-by-step instructions with images in the "Getting Started" tab.', vi: 'Bạn có thể xem các bước hướng dẫn chi tiết kèm hình ảnh trong tab "Hướng dẫn bắt đầu".', id: 'Anda dapat melihat langkah-langkah detail dengan gambar di tab "Panduan Memulai".', zh: '您可以在“入门指南”标签页中查看图文并茂的分步操作说明。', si: '"ආරම්භක මාර්ගෝපදේශය" ටැබයෙන් පින්තූර සහිත විස්තර බලන්න.', km: 'អ្នកអាចពិនិត្យមើលការណែនាំលម្អិតជាមួយរូបភាពនៅក្នុងផ្ទាំង "ការចាប់ផ្តើម"។' },
  manual_viewStartGuide: { ja: '操作スタートガイドを見る', en: 'View Getting Started Guide', vi: 'Xem hướng dẫn bắt đầu', id: 'Lihat Panduan Memulai', zh: '查看操作入门指南', si: 'ආරම්භක මාර්ගෝපදේශය බලන්න', km: 'មើលការណែនាំចាប់ផ្តើម' },
  manual_addFirstVideo: { ja: '最初の動画を登録する', en: 'Add First Video', vi: 'Thêm video đầu tiên', id: 'Tambah Video Pertama', zh: '添加第一个视频', si: 'පළමු වීඩියෝව එක් කරන්න', km: 'បន្ថែមវីដេអូដំបូង' },
  manual_playBadge: { ja: '再生', en: 'Play', vi: 'Phát', id: 'Putar', zh: '播放', si: 'වාදනය', km: 'ចាក់' },
  manual_editTelopBtn: { ja: '編集・テロップ', en: 'Edit & Subtitles', vi: 'Sửa & Phụ đề', id: 'Edit & Subtitle', zh: '编辑与字幕', si: 'සංස්කරණය සහ උපසිරැසි', km: 'កែសម្រួល & អក្សររត់' },
  manual_watchVideoBtn: { ja: '動画を見る', en: 'Watch Video', vi: 'Xem video', id: 'Tonton Video', zh: '观看视频', si: 'වීඩියෝව බලන්න', km: 'មើលវីដេអូ' },
  manual_noDescription: { ja: '説明はありません', en: 'No description', vi: 'Không có mô tả', id: 'Tidak ada deskripsi', zh: '暂无说明', si: 'විස්තරයක් නොමැත', km: 'គ្មានការពិពណ៌នា' },
  manual_confirmDelete: { ja: '本当にこの動画マニュアルを削除しますか？', en: 'Are you sure you want to delete this video manual?', vi: 'Bạn có chắc chắn muốn xóa video hướng dẫn này không?', id: 'Apakah Anda yakin ingin menghapus video manual ini?', zh: '确定要删除此视频教程吗？', si: 'ඔබට මෙම වීඩියෝව මකා දැමීමට අවශ්‍ය බව සහතිකද?', km: 'តើអ្នកប្រាកដថាចង់លុបវីដេអូណែនាំនេះទេ?' },
  manual_addModalTitle: { ja: '新規動画マニュアルを登録', en: 'Register New Video Manual', vi: 'Đăng ký video hướng dẫn mới', id: 'Daftar Manual Video Baru', zh: '注册新视频教程', si: 'නව වීඩියෝවක් ලියාපදිංචි කරන්න', km: 'ចុះឈ្មោះវីដេអូណែនាំថ្មី' },
  manual_videoTitleLabel: { ja: '動画タイトル', en: 'Video Title', vi: 'Tiêu đề video', id: 'Judul Video', zh: '视频标题', si: 'වීඩියෝ මාතෘකාව', km: 'ចំណងជើងវីដេអូ' },
  manual_videoDescLabel: { ja: '説明・重要ポイント', en: 'Description & Key Points', vi: 'Mô tả & Điểm quan trọng', id: 'Deskripsi & Poin Penting', zh: '说明与要点', si: 'විස්තරය', km: 'ការពិពណ៌នា' },
  manual_videoFileLabel: { ja: '動画ファイル (MP4 / WebM / QuickTime, 最大50MB)', en: 'Video File (MP4/WebM/QuickTime, Max 50MB)', vi: 'Tệp video (MP4/WebM/QuickTime, Tối đa 50MB)', id: 'File Video (MP4/WebM/QuickTime, Maks 50MB)', zh: '视频文件 (MP4/WebM/QuickTime, 最大50MB)', si: 'වීඩියෝ ගොනුව (උපරිම 50MB)', km: 'ឯកសារវីដេអូ (អតិបរមា 50MB)' },
  manual_submitRegisterBtn: { ja: '登録する', en: 'Register', vi: 'Đăng ký', id: 'Daftar', zh: '注册', si: 'ලියාපදිංචි කරන්න', km: 'ចុះឈ្មោះ' },
  manual_uploadingBtn: { ja: '動画をアップロード中...', en: 'Uploading Video...', vi: 'Đang tải video lên...', id: 'Memuat naik Video...', zh: '正在上传视频...', si: 'උඩුගත වෙමින් පවතී...', km: 'កំពុងផ្ទុកឡើង...' },
  // 共通
  startWork: { ja: '作業を開始する',
    en: 'Start Work',
    vi: 'Bắt đầu công việc',
    id: 'Mulai Kerja',
    zh: '开始作业',
    si: 'වැඩ ආරම්භ කරන්න',
    km: 'ចាប់ផ្តើមការងារ'
  },
  submitRecord: { ja: '登録する',
    en: 'Save Record',
    vi: 'Lưu bản ghi',
    id: 'Simpan Catatan',
    zh: '保存记录',
    si: 'වාර්තාව සුරකින්න',
    km: 'រក្សាទុកកំណត់ត្រា'
  },
  stopWork: { ja: '作業を完了する',
    en: 'Finish Work',
    vi: 'Hoàn thành công việc',
    id: 'Selesai Kerja',
    zh: '完成工作' , si: 'වැඩ සම්පූර්ණ කරන්න', km: 'បញ្ចប់ការងារ' },
  save: { ja: '保存',
    en: 'Save',
    vi: 'Lưu',
    id: 'Simpan',
    zh: '保存' , si: 'තබා ගන්න', km: 'រក្សា' },
  cancel: { ja: 'キャンセル',
    en: 'Cancel',
    vi: 'Hủy',
    id: 'Batal',
    zh: '取消' , si: 'අවලංගු කරන්න', km: 'បោះបង់' },
  memo: { ja: 'メモ (任意)',
    en: 'Memo (Optional)',
    vi: 'Ghi chú (Tùy chọn)',
    id: 'Catatan (Opsional)',
    zh: '备注 (可选)' , si: 'සටහන් (විකල්ප)', km: 'កំណត់ចំណាំ (ជាជម្រើស)' },
  memoPlaceholder: { ja: '気づいたことなど...',
    en: 'Anything you noticed...',
    vi: 'Bất cứ điều gì bạn nhận thấy...',
    id: 'Apa pun yang Anda perhatikan...',
    zh: '您注意到的任何事情...' , si: 'මා දුටු දේ...', km: 'អ្វីដែលខ្ញុំបានកត់សម្គាល់ ...' },
  
  // 現場アプリ - タブ・入力
  tabTimer: { ja: 'タイマー記録',
    en: 'Timer',
    vi: 'Đồng hồ đếm giờ',
    id: 'Pengatur Waktu',
    zh: '计时器' , si: 'ටයිමර් පටිගත කිරීම', km: 'ការថតពេលវេលា' },
  tabManual: { ja: '手入力記録',
    en: 'Manual Entry',
    vi: 'Nhập thủ công',
    id: 'Entri Manual',
    zh: '手动输入' , si: 'අතින් ඇතුල්වීමේ වාර්තාව', km: 'កំណត់ត្រាចូលដោយដៃ' },
  tabManuals: { ja: 'マニュアル',
    en: 'Manuals',
    vi: 'Sổ tay hướng dẫn',
    id: 'Panduan',
    zh: '手册' , si: 'අත්පොත', km: 'សៀវភៅដៃ' },
  
  date: { ja: '日付', en: 'Date', vi: 'Ngày', id: 'Tanggal', zh: '日期', si: 'දිනය', km: 'កាលបរិច្ឆេទ' },
  quantityAndUnit: { ja: '数量・単位', en: 'Quantity & Unit', vi: 'Số lượng & Đơn vị', id: 'Jumlah & Satuan', zh: '数量与单位', si: 'ප්‍රමාණය සහ ඒකකය', km: 'បរិមាណ និង ឯកតា' },
  // 項目ラベル
  worker: { ja: '作業者',
    en: 'Worker',
    vi: 'Công nhân',
    id: 'Pekerja',
    zh: '工人' , si: 'සේවකයා', km: 'កម្មករ' },
  crop: { ja: '作目',
    en: 'Crop',
    vi: 'Cây trồng',
    id: 'Tanaman',
    zh: '作物',
  si: 'බෝග', km: 'ដំណាំ' },
  field: { ja: '圃場 (作業場所)',
    en: 'Field (Location)',
    vi: 'Cánh đồng (Địa điểm)',
    id: 'Ladang (Lokasi)',
    zh: '田地 (位置)' , si: 'ක්ෂේත්‍රය (සේවා ස්ථානය)', km: 'វាល (កន្លែងធ្វើការ)' },
  workType: { ja: '作業内容',
    en: 'Work Type',
    vi: 'Loại công việc',
    id: 'Jenis Pekerjaan',
    zh: '工作类型' , si: 'වැඩ විස්තර', km: 'ព័ត៌មានលម្អិតការងារ' },
  material: { ja: '使用資材 (任意)',
    en: 'Material (Optional)',
    vi: 'Vật liệu (Tùy chọn)',
    id: 'Material (Opsional)',
    zh: '材料 (可选)' , si: 'භාවිතා කරන ද්‍රව්‍ය (විකල්ප)', km: 'សម្ភារៈប្រើប្រាស់ (ជាជម្រើស)' },
  amount: { ja: '使用量 (任意)',
    en: 'Amount (Optional)',
    vi: 'Số lượng (Tùy chọn)',
    id: 'Jumlah (Opsional)',
    zh: '数量 (可选)' , si: 'භාවිත ප්‍රමාණය (විකල්ප)', km: 'បរិមាណប្រើប្រាស់ (ជាជម្រើស)' },
  photo: { ja: '写真を添付 (任意)',
    en: 'Attach Photo (Optional)',
    vi: 'Đính kèm ảnh (Tùy chọn)',
    id: 'Lampirkan Foto (Opsional)',
    zh: '附加照片 (可选)' , si: 'ඡායාරූපයක් අමුණන්න (විකල්ප)', km: 'ភ្ជាប់រូបថត (ជាជម្រើស)' },
  video: { ja: '動画を添付 (任意)',
    en: 'Attach Video (Optional)',
    vi: 'Đính kèm video (Tùy chọn)',
    id: 'Lampirkan Video (Opsional)',
    zh: '附加视频 (可选)' , si: 'වීඩියෝවක් අමුණන්න (විකල්ප)', km: 'ភ្ជាប់វីដេអូ (ជាជម្រើស)' },
  
  // メッセージ
  workingNow: { ja: '作業中...',
    en: 'Working...',
    vi: 'Đang làm việc...',
    id: 'Sedang bekerja...',
    zh: '工作中...' , si: 'වැඩ කරමින්...', km: 'កំពុងធ្វើការ...' },
  recordingComplete: { ja: '記録完了！',
    en: 'Recording Complete!',
    vi: 'Ghi âm hoàn tất!',
    id: 'Perekaman Selesai!',
    zh: '记录完成！' , si: 'පටිගත කිරීම සම්පූර්ණයි!', km: 'ថតចប់ហើយ!' },
  goodJob: { ja: 'お疲れ様でした！🌱',
    en: 'Good job! 🌱',
    vi: 'Làm tốt lắm! 🌱',
    id: 'Kerja bagus! 🌱',
    zh: '干得好！🌱' , si: 'ඔබගේ මහන්සියට ස්තුතියි! 🌱', km: 'សូមអរគុណចំពោះការខិតខំប្រឹងប្រែងរបស់អ្នក! 🌱' },
  selectRequired: { ja: '選択してください',
    en: 'Please select',
    vi: 'Vui lòng chọn',
    id: 'Silakan pilih',
    zh: '请选择' , si: 'කරුණාකර තෝරන්න', km: 'សូមជ្រើសរើស' },
  
  // タブ・ヘッダー
  tabSales: { ja: '出荷・納品', en: 'Delivery & Shipping', vi: 'Xuất hàng & Giao', id: 'Pengiriman & Pasokan', zh: '发货与配送', si: 'නැව්ගත කිරීම සහ බෙදාහැරීම', km: 'ការដឹកជញ្ជូន និង ការផ្គត់ផ្គង់' },
  portal_btn: { ja: 'ポータル', en: 'Portal', vi: 'Portal', id: 'Portal', zh: '门户', si: 'පෝර්ටලය', km: 'ច្រក' },
  cmd_hub: { ja: '司令塔', en: 'Hub', vi: 'Trung tâm', id: 'Pusat Kontrol', zh: '司令塔', si: 'පාලන මධ්‍යස්ථානය', km: 'មជ្ឈមណ្ឌលបញ្ជា' },

  // チーム生産性
  teamProductivity: { ja: '本日のチーム生産性', en: "Today's Team Productivity", vi: 'Năng suất đội ngũ hôm nay', id: 'Produktivitas Tim Hari Ini', zh: '今日团队生产力', si: 'අද කණ්ඩායමේ ඵලදායිතාව', km: 'ផលិតភាពក្រុមថ្ងៃនេះ' },
  realtimeBadge: { ja: 'リアルタイム', en: 'Realtime', vi: 'Thời gian thực', id: 'Real-time', zh: '实时', si: 'තථ්‍ය කාලීන', km: 'ពេលវេលាជាក់ស្តែង' },
  teamCheerMessage: { ja: 'みんなの頑張りがチームの力になります！🚀', en: 'Everyone hard work powers the team! 🚀', vi: 'Sự nỗ lực của mọi người là sức mạnh của đội! 🚀', id: 'Kerja keras semua orang adalah kekuatan tim! 🚀', zh: '大家的努力成就团队的力量！🚀', si: 'සැමගේ කැපවීම කණ්ඩායමේ ශක්තියයි! 🚀', km: 'ការខិតខំរបស់ទាំងអស់គ្នាជាកម្លាំងក្រុម! 🚀' },
  detailBtn: { ja: '詳細 ➔', en: 'Details ➔', vi: 'Chi tiết ➔', id: 'Detail ➔', zh: '详情 ➔', si: 'විස්තර ➔', km: 'ព័ត៌មានលម្អិត ➔' },
  yieldPerHourLabel: { ja: '🌾 1時間あたり収穫量', en: '🌾 Yield per Hour', vi: '🌾 Sản lượng mỗi giờ', id: '🌾 Panen per Jam', zh: '🌾 每小时收获量', si: '🌾 පැයකට අස්වැන්න', km: '🌾 ទិន្នផលក្នុងមួយម៉ោង' },
  revenuePerHourLabel: { ja: '💰 1時間あたり生産高', en: '💰 Revenue per Hour', vi: '💰 Doanh thu mỗi giờ', id: '💰 Nilai per Jam', zh: '💰 每小时产值', si: '💰 පැයකට නිෂ්පාදන වටිනාකම', km: '💰 ប្រាក់ចំណូលក្នុងមួយម៉ោង' },
  totalWorkHoursLabel: { ja: '⏱️ 本日チーム総稼働: ', en: '⏱️ Total Team Hours: ', vi: '⏱️ Tổng giờ làm của đội: ', id: '⏱️ Total Jam Kerja Tim: ', zh: '⏱️ 今日团队总工时: ', si: '⏱️ කණ්ඩායමේ මුළු පැය: ', km: '⏱️ ម៉ោងសរុបរបស់ក្រុម: ' },
  hoursUnit: { ja: '時間', en: ' hrs', vi: ' giờ', id: ' jam', zh: ' 小时', si: ' පැය', km: ' ម៉ោង' },
  totalHarvestKgLabel: { ja: '収穫合計: ', en: 'Total Harvest: ', vi: 'Tổng thu hoạch: ', id: 'Total Panen: ', zh: '收获总计: ', si: 'මුළු අස්වැන්න: ', km: 'ការប្រមូលផលសរុប: ' },

  // 出荷・納品
  b2bDeliveryTitle: { ja: '本日の配達予定 (受注分)', en: "Today's Delivery Schedule (B2B)", vi: 'Lịch giao hàng hôm nay (Đơn hàng)', id: 'Jadwal Pengiriman Hari Ini', zh: '今日配送计划 (订单)', si: 'අද බෙදාහැරීමේ කාලසටහන', km: 'កាលវិភាគដឹកជញ្ជូនថ្ងៃនេះ' },
  noPendingB2B: { ja: '本日の未納品はありません', en: 'No pending deliveries today', vi: 'Không có đơn hàng chưa giao hôm nay', id: 'Tidak ada pengiriman tertunda hari ini', zh: '今日没有未配送订单', si: 'අද නොබෙදූ ඇණවුම් නොමැත', km: 'មិនមានការដឹកជញ្ជូនដែលមិនទាន់សម្រេចនៅថ្ងៃនេះទេ' },
  markDeliveredBtn: { ja: '納品完了', en: 'Delivered', vi: 'Đã giao hàng', id: 'Terkirim', zh: '完成配送', si: 'බෙදාහැරීම අවසන්', km: 'បានដឹកជញ្ជូនរួចរាល់' },
  adHocSalesTitle: { ja: '都度出荷の記録 (JA・直売所等)', en: 'Ad-hoc Sales / Shipping (JA, Direct, etc.)', vi: 'Ghi nhận xuất hàng (JA, Điểm bán trực tiếp)', id: 'Catatan Pengiriman (JA, Pasar Langsung, dll)', zh: '随行出货记录 (农协、直销所等)', si: 'නැව්ගත කිරීමේ වාර්තාව (JA, සෘජු වෙළඳපොල ආදිය)', km: 'កំណត់ត្រាដឹកជញ្ជូន (JA, ទីផ្សារផ្ទាល់ ជាដើម)' },
  salesChannelLabel: { ja: '出荷先 (販路)', en: 'Sales Channel', vi: 'Kênh bán / Nơi nhận', id: 'Saluran Penjualan', zh: '出货渠道 (销售渠道)', si: 'විකුණුම් මාර්ගය', km: 'បណ្តាញលក់' },
  cropLabel: { ja: '作目', en: 'Crop', vi: 'Loại cây trồng', id: 'Tanaman', zh: '作物', si: 'බෝගය', km: 'ដំណាំ' },
  selectPlaceholder: { ja: '選択してください', en: 'Please select', vi: 'Vui lòng chọn', id: 'Silakan pilih', zh: '请选择', si: 'කරුණාකර තෝරන්න', km: 'សូមជ្រើសរើស' },
  recordShippingBtn: { ja: '出荷を記録する', en: 'Record Shipping', vi: 'Lưu xuất hàng', id: 'Simpan Pengiriman', zh: '记录出货', si: 'නැව්ගත කිරීම වාර්තා කරන්න', km: 'កត់ត្រាការដឹកជញ្ជូន' },
  recordingShippingBtn: { ja: '記録中...', en: 'Recording...', vi: 'Đang lưu...', id: 'Menyimpan...', zh: '记录中...', si: 'වාර්තා වෙමින් පවතී...', km: 'កំពុងកត់ត្រា...' },

  // 残業・その他
  overtimeApplyTitle: { ja: '残業の申請（事前申請可）', en: 'Overtime Request', vi: 'Đăng ký làm thêm giờ', id: 'Pengajuan Lembur', zh: '加班申请 (可提前申请)', si: 'අතිකාල ඉල්ලීම', km: 'សំណើសុំធ្វើការថែមម៉ោង' },
  overtimePending: { ja: '【本日】残業申請中（承認待ち）', en: '[Today] Overtime Pending Approval', vi: '[Hôm nay] Đang chờ duyệt tăng ca', id: '[Hari ini] Menunggu Persetujuan Lembur', zh: '【今日】加班申请审核中', si: '[අද] අතිකාල අනුමැතිය බලාපොරොත්තුවෙන්', km: '[ថ្ងៃនេះ] កំពុងរង់ចាំការអនុម័តថែមម៉ោង' },
  overtimeApproved: { ja: '【本日】残業申請 承認済み', en: '[Today] Overtime Approved', vi: '[Hôm nay] Đã duyệt tăng ca', id: '[Hari ini] Lembur Disetujui', zh: '【今日】加班申请已通过', si: '[අද] අතිකාල අනුමත කර ඇත', km: '[ថ្ងៃនេះ] បានអនុម័តថែមម៉ោង' },
  photoTakeOrSelect: { ja: '撮影 または ファイルを選択', en: 'Take Photo or Select File', vi: 'Chụp ảnh hoặc chọn tệp', id: 'Ambil Foto atau Pilih File', zh: '拍照或选择文件', si: 'ඡායාරූපයක් ගන්න හෝ ගොනුවක් තෝරන්න', km: 'ថតរូប ឬ ជ្រើសរើសឯកសារ' },
  workMemoPlaceholder: { ja: '作業メモ...', en: 'Work memo...', vi: 'Ghi chú công việc...', id: 'Catatan kerja...', zh: '作业备注...', si: 'වැඩ සටහන්...', km: 'កំណត់ចំណាំការងារ...' },
  videoSectionLabel: { ja: '動画', en: 'Video', vi: 'Video', id: 'Video', zh: '视频', si: 'වීඩියෝ', km: 'វីដេអូ' },
  usageAmount: { ja: '使用量', en: 'Amount used', vi: 'Lượng sử dụng', id: 'Jumlah terpakai', zh: '使用量', si: 'භාවිතා කළ ප්‍රමාණය', km: 'បរិមាណប្រើប្រាស់' },
  addNewWorkType: { ja: '新規追加', en: '+ Add New', vi: '+ Thêm mới', id: '+ Tambah Baru', zh: '+ 新增', si: '+ අලුතින් එක් කරන්න', km: '+ បន្ថែមថ្មី' },
  confirmWorkType: { ja: '決定', en: 'Confirm', vi: 'Xác nhận', id: 'Konfirmasi', zh: '确定', si: 'තහවුරු කරන්න', km: 'បញ្ជាក់' },
  enterWorkTypePlaceholder: { ja: '作業内容を入力', en: 'Enter work content', vi: 'Nhập nội dung công việc', id: 'Masukkan isi pekerjaan', zh: '输入作业内容', si: 'වැඩ අන්තර්ගතය ඇතුළත් කරන්න', km: 'បញ្ចូលខ្លឹមសារការងារ' },
  fieldWorkplace: { ja: '圃場 (作業場所)', en: 'Field (Location)', vi: 'Ruộng (Vị trí làm việc)', id: 'Ladang (Lokasi)', zh: '地块 (作业场所)', si: 'ක්ෂේත්‍රය (ස්ථානය)', km: 'ដីស្រែ (ទីតាំង)' },
  selectFieldPlaceholder: { ja: '圃場を選択してください', en: 'Please select a field', vi: 'Vui lòng chọn ruộng', id: 'Silakan pilih ladang', zh: '请选择地块', si: 'කරුණාකර ක්ෂේත්‍රයක් තෝරන්න', km: 'សូមជ្រើសរើសដីស្រែ' },
  workContentLabel: { ja: '作業内容', en: 'Work Content', vi: 'Nội dung công việc', id: 'Isi Pekerjaan', zh: '作业内容', si: 'වැඩ අන්තර්ගතය', km: 'ខ្លឹមសារការងារ' },
  memoSectionLabel: { ja: 'メモ', en: 'Memo', vi: 'Ghi chú', id: 'Catatan', zh: '备注', si: 'සටහන', km: 'កំណត់ចំណាំ' },

  // カレンダー・スケジュール
  cal_allEvents: { ja: '全員の予定', en: "Everyone's Schedule", vi: 'Lịch của tất cả', id: 'Jadwal Semua', zh: '全员日程', si: 'සැමගේ කාලසටහන', km: 'កាលវិភាគទាំងអស់' },
  cal_myTasksOnly: { ja: '担当タスクのみ', en: 'My Tasks Only', vi: 'Chỉ nhiệm vụ của tôi', id: 'Hanya Tugas Saya', zh: '仅我的任务', si: 'මගේ කාර්යයන් පමණි', km: 'កិច្ចការរបស់ខ្ញុំតែប៉ុណ្ណោះ' },
  cal_targetWorker: { ja: '担当者表示:', en: 'Worker Filter:', vi: 'Lọc theo người:', id: 'Filter Pekerja:', zh: '按人员筛选:', si: 'සේවක පෙරහන:', km: 'តម្រងបុគ្គលិក:' },
  cal_allStaffOption: { ja: '全員', en: 'All Staff', vi: 'Tất cả nhân viên', id: 'Semua Staf', zh: '全员', si: 'සියලුම සේවකයින්', km: 'បុគ្គលិកទាំងអស់' },
  cal_highlighting: { ja: 'をハイライト中', en: 'highlighted', vi: 'đang được đánh dấu', id: 'sedang disorot', zh: '高亮显示中', si: 'උද්දීපනය කර ඇත', km: 'កំពុងរំលេច' },
  cal_dailyScheduleDetail: { ja: '1日のスケジュール詳細', en: "Day's Schedule Details", vi: 'Chi tiết lịch trình trong ngày', id: 'Detail Jadwal Harian', zh: '当日日程详情', si: 'දවසේ කාලසටහන විස්තර', km: 'សេចក្តីលម្អិតកាលវិភាគប្រចាំថ្ងៃ' },
  cal_noTasksThisDay: { ja: 'この日のタスク・予定はありません', en: 'No tasks or events on this day', vi: 'Không có nhiệm vụ hoặc sự kiện nào trong ngày này', id: 'Tidak ada tugas atau acara pada hari ini', zh: '本日没有任务或日程', si: 'මෙම දිනයේ කාර්යයන් හෝ සිදුවීම් නොමැත', km: 'មិនមានកិច្ចការ ឬ ព្រឹត្តិការណ៍នៅថ្ងៃនេះទេ' },
  cal_scheduledBadge: { ja: '予定', en: 'Scheduled', vi: 'Dự kiến', id: 'Terjadwal', zh: '计划', si: 'සැලසුම් කර ඇත', km: 'បានកំណត់ពេល' },
  cal_yourAssignedTask: { ja: 'あなたの担当タスク', en: 'Your Assigned Task', vi: 'Nhiệm vụ của bạn', id: 'Tugas Anda', zh: '您的负责任务', si: 'ඔබගේ වගකීම් කාර්යය', km: 'កិច្ចការដែលអ្នកទទួលខុសត្រូវ' },
  cal_assigneeWho: { ja: '担当者 (誰が)', en: 'Assignee (Who)', vi: 'Người phụ trách (Ai)', id: 'Penanggung Jawab (Siapa)', zh: '负责人 (谁)', si: 'වගකිවයුතු (කවුද)', km: 'អ្នកទទួលខុសត្រូវ (នរណា)' },
  cal_locationWhere: { ja: '場所 (どこで)', en: 'Location (Where)', vi: 'Địa điểm (Ở đâu)', id: 'Lokasi (Di mana)', zh: '场所 (何处)', si: 'ස්ථානය (කොහේද)', km: 'ទីតាំង (កន្លែងណា)' },
  cal_myselfSuffix: { ja: '(自分)', en: '(Me)', vi: '(Tôi)', id: '(Saya)', zh: '(自己)', si: '(මම)', km: '(ខ្ញុំ)' },

  // 指示・タスク
  todayTasksHeader: { ja: '本日の指示・タスク', en: "Today's Assigned Tasks", vi: 'Chỉ thị & Nhiệm vụ hôm nay', id: 'Tugas Hari Ini', zh: '今日任务指示', si: 'අද උපදෙස් සහ කාර්යයන්', km: 'ការណែនាំ និង កិច្ចការថ្ងៃនេះ' },
  detail: { ja: '詳細', en: 'Detail', vi: 'Chi tiết', id: 'Detail', zh: '详情', si: 'විස්තර', km: 'ព័ត៌មានលម្អិត' },
  taskDetailTitle: { ja: '作業指示・タスク詳細', en: 'Task Details & Instructions', vi: 'Chi tiết chỉ thị & Nhiệm vụ', id: 'Detail Tugas & Instruksi', zh: '作业指示与任务详情', si: 'කාර්ය විස්තර සහ උපදෙස්', km: 'សេចក្តីលម្អិតកិច្ចការ និង ការណែនាំ' },
  taskAssignee: { ja: '担当者', en: 'Assignee', vi: 'Người phụ trách', id: 'Penanggung Jawab', zh: '负责人', si: 'වගකිවයුතු පුද්ගලයා', km: 'អ្នកទទួលខុសត្រូវ' },
  unspecified: { ja: '指定なし', en: 'Not specified', vi: 'Không chỉ định', id: 'Tidak ditentukan', zh: '未指定', si: 'නිශ්චිතව දක්වා නැත', km: 'មិនបានបញ្ជាក់' },
  generalWork: { ja: '一般作業', en: 'General Work', vi: 'Công việc chung', id: 'Pekerjaan Umum', zh: '一般作业', si: 'සාමාන්‍ය වැඩ', km: 'ការងារទូទៅ' },
  instructionsNotes: { ja: '指示・備考メモ', en: 'Instructions & Notes', vi: 'Chỉ thị & Ghi chú', id: 'Instruksi & Catatan', zh: '指示与备注', si: 'උපදෙස් සහ සටහන්', km: 'ការណែនាំ និង កំណត់ចំណាំ' },
  applyTaskToInput: { ja: 'この指示を作業入力に反映する', en: 'Apply Task to Work Entry', vi: 'Áp dụng vào biểu mẫu ghi nhận', id: 'Terapkan Instruksi ke Form', zh: '将此指示填入作业记录', si: 'මෙම උපදෙස් වැඩ ආදානයට යොදන්න', km: 'អនុវត្តការណែនាំនេះទៅក្នុងការបញ្ចូលការងារ' },
  close: { ja: '閉じる', en: 'Close', vi: 'Đóng', id: 'Tutup', zh: '关闭', si: 'වසා දමන්න', km: 'បិទ' },

  // 動画マニュアル関連
  videoManuals: { ja: '動画マニュアル集', en: 'Video Manuals', vi: 'Hướng dẫn bằng video', id: 'Manual Video', zh: '视频手册'
   , si: 'වීඩියෝ අත්පොත එකතුව', km: 'ការប្រមូលវីដេអូដោយដៃ' },
  noManuals: { ja: '現在登録されているマニュアルはありません', en: 'No manuals currently registered', vi: 'Hiện không có hướng dẫn nào được đăng ký', id: 'Tidak ada manual yang terdaftar saat ini', zh: '目前没有注册的手册'
   , si: 'දැනට ලියාපදිංචි අත්පොත් නොමැත.', km: 'បច្ចុប្បន្នមិនមានសៀវភៅណែនាំដែលបានចុះឈ្មោះទេ។' },
  // 出荷記録関連
  salesRecord: { ja: '出荷記録', en: 'Sales Record', vi: 'Ghi nhận xuất hàng', id: 'Catatan Penjualan', zh: '发货记录'
   , si: 'නැව්ගත කිරීමේ වාර්තාව', km: 'កំណត់ត្រាដឹកជញ្ជូន' },
  autoCalcDesc: { ja: '数量だけ入れて自動計算！', en: 'Auto calculated just by entering quantity!', vi: 'Tự động tính toán chỉ bằng cách nhập số lượng!', id: 'Dihitung otomatis hanya dengan memasukkan jumlah!', zh: '只需输入数量即可自动计算！'
   , si: 'ප්‍රමාණය ඇතුළත් කරන්න, එය ස්වයංක්‍රීයව ගණනය කෙරේ!', km: 'គ្រាន់តែបញ្ចូលបរិមាណវានឹងត្រូវបានគណនាដោយស្វ័យប្រវត្តិ!' },
  salesCompleted: { ja: '出荷記録完了！', en: 'Sales Record Completed!', vi: 'Hoàn thành ghi nhận xuất hàng!', id: 'Catatan Penjualan Selesai!', zh: '发货记录完成！'
   , si: 'නැව්ගත කිරීමේ වාර්තාව සම්පූර්ණයි!', km: 'កំណត់ត្រាដឹកជញ្ជូនបានបញ្ចប់!' },
  salesAutoCalculated: { ja: '売上も自動計算されました🚚', en: 'Sales calculated automatically🚚', vi: 'Doanh thu cũng được tính tự động🚚', id: 'Penjualan juga dihitung secara otomatis🚚', zh: '销售额也已自动计算🚚'
   , si: 'විකුණුම් ද ස්වයංක්‍රීයව ගණනය කරන ලදී 🚚', km: 'ការលក់ក៏ត្រូវបានគណនាដោយស្វ័យប្រវត្តិផងដែរ 🚚' },
  salesChannel: { ja: '出荷先', en: 'Sales Channel', vi: 'Nơi xuất hàng', id: 'Saluran Penjualan', zh: '出货方'
  , si: 'විකුණුම් නාලිකාව', km: 'បណ្តាញលក់' },
  selectCropFirst: { ja: '先に作目を選択してください', en: 'Please select a crop first', vi: 'Vui lòng chọn loại cây trồng trước', id: 'Silakan pilih tanaman terlebih dahulu', zh: '请先选择作物'
  , si: 'කරුණාකර පළමුව බෝගයක් තෝරන්න', km: 'សូមជ្រើសរើសដំណាំជាមុនសិន' },
  noPriceMaster: { ja: 'この作目の販売価格マスタが登録されていません。', en: 'Sales price master for this crop is not registered.', vi: 'Bảng giá cho loại cây trồng này chưa được đăng ký.', id: 'Master harga jual untuk tanaman ini belum terdaftar.', zh: '未注册该作物的销售价格主数据。'
  , si: 'මෙම බෝගය සඳහා විකුණුම් මිල ලියාපදිංචි කර නොමැත.', km: 'តម្លៃលក់សម្រាប់ដំណាំនេះមិនត្រូវបានចុះឈ្មោះទេ។' },
  quantityRequired: { ja: '出荷量・数 (必須)', en: 'Quantity (Required)', vi: 'Số lượng xuất (Bắt buộc)', id: 'Kuantitas (Wajib)', zh: '发货量/数量 (必填)'
  , si: 'ප්‍රමාණය (අවශ්‍යයි)', km: 'បរិមាណ (ទាមទារ)' },
  appliedPrice: { ja: '適用単価', en: 'Applied Unit Price', vi: 'Đơn giá áp dụng', id: 'Harga Satuan Diterapkan', zh: '适用单价'
  , si: 'අදාළ ඒකක මිල', km: 'តម្លៃឯកតាដែលបានអនុវត្ត' },
  editable: { ja: '手動変更可', en: 'Editable', vi: 'Có thể chỉnh sửa thủ công', id: 'Dapat diedit', zh: '可手动更改'
  , si: 'සංස්කරණය කළ හැක', km: 'អាចកែសម្រួលបាន' },
  unit: { ja: '単位', en: 'Unit', vi: 'Đơn vị', id: 'Satuan', zh: '单位'
   , si: 'ඒකකය', km: 'ឯកតា' },
  actualSales: { ja: '売上実績 (自動計算)', en: 'Actual Sales (Auto Calc)', vi: 'Doanh thu thực tế (Tự động)', id: 'Penjualan Aktual (Hitung Otomatis)', zh: '实际销售额 (自动计算)'
   , si: 'විකුණුම් ප්‍රතිඵල (ස්වයංක්‍රීයව ගණනය කෙරේ)', km: 'លទ្ធផលលក់ (គណនាដោយស្វ័យប្រវត្តិ)' },
  saveSalesRecord: { ja: '出荷記録を保存する', en: 'Save Sales Record', vi: 'Lưu ghi nhận xuất hàng', id: 'Simpan Catatan Penjualan', zh: '保存发货记录'
   , si: 'නැව්ගත කිරීමේ වාර්තා සුරකින්න', km: 'រក្សាទុកកំណត់ត្រាដឹកជញ្ជូន' },
  loadingData: { ja: 'データ取得中...', en: 'Loading data...', vi: 'Đang tải dữ liệu...', id: 'Memuat data...', zh: '正在加载数据...'
   , si: 'දත්ත ලබා ගනිමින්...', km: 'ការ​ទទួល​បាន​ទិន្នន័យ...' },
  
  // エラー・その他
  pinRequired: { ja: 'PINコードを入力',
    en: 'Enter PIN code',
    vi: 'Nhập mã PIN',
    id: 'Masukkan kode PIN',
    zh: '输入 PIN 码' , si: 'PIN කේතය ඇතුලත් කරන්න', km: 'បញ្ចូលកូដ PIN' },
  login: { ja: 'ログイン',
    en: 'Login',
    vi: 'Đăng nhập',
    id: 'Masuk',
    zh: '登录' , si: 'ඇතුල් වන්න', km: 'ចូល' },
  
  // page.tsx (ルートページ) 専用
  workRecord: { ja: '作業記録', en: 'Work Record', vi: 'Ghi nhận công việc', id: 'Catatan Kerja', zh: '工作记录'
   , si: 'වැඩ වාර්තාව', km: 'កំណត់ត្រាការងារ' },
  goodWork: { ja: 'お疲れ様です', en: 'Good work', vi: 'Làm tốt lắm', id: 'Kerja bagus', zh: '辛苦了'
   , si: 'ඔබගේ මහන්සියට ස්තුතියි', km: 'សូមអរគុណចំពោះការខិតខំប្រឹងប្រែងរបស់អ្នក។' },
  currentlyWorking: { ja: '現在作業中...', en: 'Currently working...', vi: 'Hiện đang làm việc...', id: 'Sedang bekerja...', zh: '目前正在工作...'
   , si: 'දැනට වැඩ...', km: 'បច្ចុប្បន្នកំពុងធ្វើការ...' },
  noMaterial: { ja: '資材を選ばない', en: 'No material', vi: 'Không có vật liệu', id: 'Tidak ada material', zh: '不选材料'
   , si: 'ද්රව්ය තෝරාගැනීමක් නැත', km: 'គ្មានជម្រើសនៃសម្ភារៈ' },
  minute: { ja: '分', en: 'min', vi: 'phút', id: 'menit', zh: '分钟'
   , si: 'මිනිත්තු', km: 'នាទី' },
  // WorkerGate用
  workerLogin: { ja: '現場ログイン', en: 'Worker Login', vi: 'Đăng nhập nhân viên', id: 'Login Pekerja', zh: '工人登录'
   , si: 'අඩවියට පිවිසීම', km: 'ការចូលនៅនឹងកន្លែង' },
  yourName: { ja: 'お名前', en: 'Your Name', vi: 'Tên của bạn', id: 'Nama Anda', zh: '您的名字'
   , si: 'නම', km: 'ឈ្មោះ' },
  selectNamePrompt: { ja: '自分の名前と暗証番号を入力してください', en: 'Enter your name and PIN', vi: 'Nhập tên và mã PIN của bạn', id: 'Masukkan nama dan PIN Anda', zh: '输入您的名字和 PIN'
   , si: 'කරුණාකර ඔබගේ නම සහ PIN ඇතුලත් කරන්න', km: 'សូមបញ្ចូលឈ្មោះ និងលេខសម្ងាត់របស់អ្នក។' },
  selectName: { ja: '名前を選択してください', en: 'Please select your name', vi: 'Vui lòng chọn tên của bạn', id: 'Silakan pilih nama Anda', zh: '请选择您的名字'
   , si: 'කරුණාකර නමක් තෝරන්න', km: 'សូមជ្រើសរើសឈ្មោះមួយ។' },
  yourPin: { ja: '暗証番号 (4桁)', en: 'PIN (4 digits)', vi: 'Mã PIN (4 chữ số)', id: 'PIN (4 digit)', zh: 'PIN (4 位数字)'
   , si: 'PIN අංකය (ඉලක්කම් 4)', km: 'លេខ PIN (4 ខ្ទង់)' },
  pinHint: { ja: '※初期設定は「0000」です', en: '* Default is "0000"', vi: '* Mặc định là "0000"', id: '* Bawaan adalah "0000"', zh: '* 默认为“0000”'
   , si: '* මූලික සැකසුම "0000"', km: '* ការកំណត់ដំបូងគឺ "0000"' },
  incorrectPin: { ja: '暗証番号が間違っています。', en: 'Incorrect PIN.', vi: 'Mã PIN không đúng.', id: 'PIN salah.', zh: 'PIN 错误。'
   , si: 'PIN අංකය වැරදියි.', km: 'លេខ PIN មិនត្រឹមត្រូវទេ។' },
  loginFailed: { ja: 'ログインに失敗しました。', en: 'Login failed.', vi: 'Đăng nhập thất bại.', id: 'Gagal masuk.', zh: '登录失败。'
   , si: 'ඇතුළු වීම අසාර්ථක විය.', km: 'ការចូលបានបរាជ័យ។' },
  loginAndStart: { ja: 'ログインして作業開始', en: 'Login & Start Work', vi: 'Đăng nhập & Bắt đầu làm việc', id: 'Login & Mulai Kerja', zh: '登录并开始工作'
   , si: 'ලොග් වෙලා වැඩ පටන් ගන්න', km: 'ចូលហើយចាប់ផ្តើមធ្វើការ' },
  
  // 作業内容（固定）
  '収穫': { ja: '収穫', en: 'Harvest', vi: 'Thu hoạch', id: 'Panen', zh: '收获'
  , si: 'අස්වැන්න', km: 'ការប្រមូលផល' },
  '定植・播種': { ja: '定植・播種', en: 'Planting / Sowing', vi: 'Trồng / Gieo hạt', id: 'Menanam / Menyemai', zh: '定植/播种'
  , si: 'සිටුවීම / වැපිරීම', km: 'ការដាំ / ការសាបព្រួស' },
  '播種': { ja: '播種', en: 'Sowing', vi: 'Gieo hạt', id: 'Menyemai', zh: '播种'
  , si: 'වැපිරීම', km: 'ការសាបព្រួស' },
  '定植': { ja: '定植', en: 'Planting', vi: 'Trồng cây', id: 'Menanam', zh: '定植'
  , si: 'සිටුවීම', km: 'ការដាំ' },
  '水やり': { ja: '水やり', en: 'Watering', vi: 'Tưới nước', id: 'Menyiram', zh: '浇水'
  , si: 'වතුර දැමීම', km: 'ការស្រោចទឹក' },
  '肥料・農薬': { ja: '肥料・農薬', en: 'Fertilizer / Pesticide', vi: 'Phân bón / Thuốc trừ sâu', id: 'Pupuk / Pestisida', zh: '肥料/农药'
  , si: 'පොහොර / පළිබෝධනාශක', km: 'ជី / ថ្នាំសម្លាប់សត្វល្អិត' },
  '草刈り': { ja: '草刈り', en: 'Weeding / Mowing', vi: 'Cắt cỏ', id: 'Membabat rumput', zh: '除草'
  , si: 'වල් නෙලීම', km: 'ការកាត់ស្មៅ' },
  '片付け・メンテ': { ja: '片付け・メンテ', en: 'Cleanup / Maintenance', vi: 'Dọn dẹp / Bảo trì', id: 'Pembersihan / Perawatan', zh: '清理/维护'
  , si: 'පිරිසිදු කිරීම / නඩත්තු කිරීම', km: 'ការសម្អាត / ការថែទាំ' },
  // 勤怠関連の新規追加分
  attendance: { ja: '勤怠打刻', en: 'Attendance', vi: 'Chấm công', id: 'Kehadiran', zh: '考勤打卡' , si: 'පැමිණීම', km: 'ការចូលរួម' },
  realtimeRecord: { ja: 'リアルタイム記録', en: 'Realtime Record', vi: 'Ghi thời gian thực', id: 'Rekam Waktu Nyata', zh: '实时记录' , si: 'තත්‍ය කාලීන වාර්තාව', km: 'កំណត់ត្រាពេលវេលាពិត' },
  manualRecord: { ja: 'あとから記録', en: 'Manual Record', vi: 'Ghi thủ công', id: 'Rekam Manual', zh: '手动记录' , si: 'අත්පොත වාර්තාව', km: 'កំណត់ត្រាដោយដៃ' },
  workingTime: { ja: '作業時間 (分)', en: 'Working Time (min)', vi: 'Thời gian làm việc (phút)', id: 'Waktu Kerja (menit)', zh: '工作时间 (分钟)' , si: 'වැඩ කරන වේලාව (විනාඩි)', km: 'ពេលវេលាធ្វើការ (នាទី)' },
  working: { ja: '作業中', en: 'Working', vi: 'Đang làm việc', id: 'Sedang Bekerja', zh: '正在工作' , si: 'වැඩ කරමින්', km: 'កំពុងធ្វើការ' },
  minutes: { ja: '分', en: 'min', vi: 'phút', id: 'menit', zh: '分钟' , si: 'විනාඩි', km: 'នាទី' },
  clockIn: { ja: '出勤', en: 'Clock In', vi: 'Vào làm', id: 'Masuk Kerja', zh: '上班' , si: 'වැඩට පැමිණීම', km: 'ចូលធ្វើការ' },
  clockOut: { ja: '退勤', en: 'Clock Out', vi: 'Tan làm', id: 'Pulang Kerja', zh: '下班' , si: 'වැඩ නිම කිරීම', km: 'ចេញពីធ្វើការ' },
  breakStart: { ja: '休憩開始', en: 'Start Break', vi: 'Bắt đầu nghỉ', id: 'Mulai Istirahat', zh: '开始休息' , si: 'විවේකය ආරම්භ කරන්න', km: 'ចាប់ផ្តើមសម្រាក' },
  breakEnd: { ja: '休憩を終了して戻る', en: 'End Break', vi: 'Kết thúc nghỉ', id: 'Selesai Istirahat', zh: '结束休息' , si: 'විවේකය අවසන් කරන්න', km: 'បញ្ចប់ការសម្រាក' },
  statusNotStarted: { ja: '未出勤', en: 'Not Started', vi: 'Chưa vào làm', id: 'Belum Mulai', zh: '未上班' , si: 'ආරම්භ කර නැත', km: 'មិនទាន់ចាប់ផ្តើម' },
  statusWorking: { ja: '勤務中', en: 'Working', vi: 'Đang làm việc', id: 'Sedang Bekerja', zh: '工作中' , si: 'වැඩ කරමින්', km: 'កំពុងធ្វើការ' },
  statusBreak: { ja: '休憩中', en: 'On Break', vi: 'Đang nghỉ', id: 'Sedang Istirahat', zh: '休息中' , si: 'විවේකයේ', km: 'កំពុងសម្រាក' },
  statusFinished: { ja: '退勤済', en: 'Finished', vi: 'Đã tan làm', id: 'Selesai', zh: '已下班' , si: 'අවසන්', km: 'បានបញ្ចប់' },
  weatherInfo: { ja: '天候', en: 'Weather', vi: 'Thời tiết', id: 'Cuaca', zh: '天气' , si: 'කාලගුණය', km: 'អាកាសធាតុ' },
  systemTitle: { ja: '現場システム', en: 'Field System', vi: 'Hệ thống hiện trường', id: 'Sistem Lapangan', zh: '现场系统' , si: 'ක්ෂේත්‍ර පද්ධතිය', km: 'ប្រព័ន្ធវាល' },
  selectField: { ja: '圃場を選択してください', en: 'Please select a field', vi: 'Vui lòng chọn cánh đồng', id: 'Silakan pilih ladang', zh: '请选择田地' , si: 'කරුණාකර ක්ෂේත්‍රයක් තෝරන්න', km: 'សូមជ្រើសរើសវាលមួយ' },
  locationOff: { ja: '位置情報がオフです', en: 'Location is off', vi: 'Vị trí đã tắt', id: 'Lokasi mati', zh: '位置信息已关闭' , si: 'ස්ථානය අක්‍රියයි', km: 'ទីតាំងត្រូវបានបិទ' },
  gpsChecking: { ja: 'GPS判定中...', en: 'Checking GPS...', vi: 'Đang kiểm tra GPS...', id: 'Memeriksa GPS...', zh: '正在检查 GPS...' , si: 'GPS පරීක්ෂා කරමින්...', km: 'កំពុងពិនិត្យ GPS...' },
  gpsAutoSelect: { ja: '📍 自動選択:', en: '📍 Auto select:', vi: '📍 Tự động chọn:', id: '📍 Pilih otomatis:', zh: '📍 自动选择:' , si: '📍 ස්වයංක්‍රීය තේරීම:', km: '📍 ជ្រើសរើសដោយស្វ័យប្រវត្តិ៖' },
  outOfField: { ja: '📍 圃場外', en: '📍 Out of field', vi: '📍 Ngoài cánh đồng', id: '📍 Di luar ladang', zh: '📍 田地外' , si: '📍 ක්ෂේත්‍රයෙන් පිටත', km: '📍 នៅក្រៅវាល' },
  gpsFailed: { ja: '⚠️ GPS取得失敗', en: '⚠️ GPS failed', vi: '⚠️ Không lấy được GPS', id: '⚠️ GPS gagal', zh: '⚠️ GPS 获取失败', si: '⚠️ GPS ලබා ගැනීම අසාර්ථකයි', km: '⚠️ ទទួលបាន GPS បរាជ័យ' },
  navWork: { ja: '作業記録', en: 'Work Log', vi: 'Ghi nhận công việc', id: 'Catatan Kerja', zh: '工作记录', si: 'කාර්ය වාර්තාව', km: 'កំណត់ហេតុការងារ' },
  navSales: { ja: '出荷記録', en: 'Sales Log', vi: 'Ghi nhận xuất hàng', id: 'Catatan Pengiriman', zh: '发货记录', si: 'නැව්ගත කිරීමේ වාර්තාව', km: 'កំណត់ត្រាការដឹកជញ្ជូន' },
  navAdmin: { ja: '管理', en: 'Admin', vi: 'Quản lý', id: 'Admin', zh: '管理', si: 'කළමනාකරණය', km: 'ការគ្រប់គ្រង' },
  defaultUnit: { ja: 'kg/箱', en: 'kg/box', vi: 'kg/hộp', id: 'kg/kotak', zh: 'kg/箱', si: 'kg/පෙට්ටිය', km: 'kg/ប្រអប់' },
  
  // LINE通知関連
  lineAlertTitle: { ja: '打刻忘れ防止アラート（LINE通知）', en: 'Clock-out Alert (LINE)', vi: 'Cảnh báo quên chấm công (LINE)', id: 'Peringatan Lupa Absen (LINE)', zh: '下班打卡提醒 (LINE)', si: 'පැමිණීම අමතක වීමේ අනතුරු ඇඟවීම (LINE)', km: 'ការជូនដំណឹងភ្លេចថត (LINE)' },
  lineAlertDesc1: { ja: '退勤の押し忘れ時に、LINEへお知らせをお届けします。', en: 'You will receive a LINE message if you forget to clock out.', vi: 'Bạn sẽ nhận được tin nhắn LINE nếu quên chấm công ra.', id: 'Anda akan menerima pesan LINE jika lupa absen pulang.', zh: '如果您忘记打卡下班，将收到LINE通知。', si: 'ඔබට වැඩ නිම කිරීම සටහන් කිරීමට අමතක වුවහොත් LINE පණිවිඩයක් ලැබෙනු ඇත.', km: 'អ្នកនឹងទទួលបានសារ LINE ប្រសិនបើអ្នកភ្លេចថតម៉ោងចេញ។' },
  lineAlertDesc2: { ja: '下のボタンを押すと、自動的に連携用キーがコピーされてLINEが開きます。', en: 'Press the button below to auto-copy your key and open LINE.', vi: 'Nhấn nút bên dưới để tự động sao chép mã của bạn và mở LINE.', id: 'Tekan tombol di bawah untuk menyalin otomatis kunci Anda dan membuka LINE.', zh: '点击下方按钮将自动复制您的密钥并打开LINE。', si: 'ඔබගේ යතුර ස්වයංක්‍රීයව පිටපත් කර LINE විවෘත කිරීමට පහත බොත්තම ඔබන්න.', km: 'ចុចប៊ូតុងខាងក្រោមដើម្បីចម្លងកូដរបស់អ្នកដោយស្វ័យប្រវត្តិហើយបើក LINE ។' },
  lineAlertDesc3: { ja: 'トークの入力欄に「ペースト（貼り付け）」して送信してください。', en: 'Please paste it into the chat input and send it.', vi: 'Vui lòng dán nó vào khung chat và gửi.', id: 'Silakan tempel di kotak obrolan dan kirim.', zh: '请将其粘贴到聊天输入框并发送。', si: 'කරුණාකර එය චැට් එකට පේස්ට් කර යවන්න.', km: 'សូមបិទភ្ជាប់វាទៅក្នុងការបញ្ចូលជជែកហើយផ្ញើវា។' },
  lineConnectBtn: { ja: 'システムとLINEを連携する', en: 'Link System with LINE', vi: 'Liên kết hệ thống với LINE', id: 'Tautkan Sistem dengan LINE', zh: '将系统与LINE关联', si: 'LINE සමඟ පද්ධතිය සම්බන්ධ කරන්න', km: 'ភ្ជាប់ប្រព័ន្ធជាមួយ LINE' },
  lineLinked: { ja: 'LINE連携済み', en: 'LINE Linked', vi: 'Đã liên kết LINE', id: 'LINE Taut', zh: 'LINE已关联', si: 'LINE සම්බන්ධ කර ඇත', km: 'បានភ្ជាប់ LINE' },
  lineNotifyDesc: { ja: '退勤忘れ時に通知が届きます', en: 'You will be notified if you forget to clock out', vi: 'Bạn sẽ được thông báo nếu quên chấm công ra', id: 'Anda akan diberitahu jika lupa absen pulang', zh: '如果您忘记下班打卡将会收到通知', si: 'වැඩ නිම කිරීමට අමතක වුවහොත් දැනුම් දෙනු ලැබේ', km: 'អ្នកនឹងត្រូវបានជូនដំណឹងប្រសិនបើអ្នកភ្លេចថតម៉ោងចេញ' },

  // 掲示板関連
  board: { ja: '社内掲示板', en: 'Board', vi: 'Bảng tin', id: 'Papan', zh: '公告板', si: 'දැන්වීම් පුවරුව', km: 'ក្ដារខៀន' },
  boardPostPlaceholder: { ja: 'みんなに伝えたいこと（生活情報・業務報告など）を書きましょう！', en: 'Write something to share with everyone!', vi: 'Viết gì đó để chia sẻ với mọi người!', id: 'Tulis sesuatu untuk dibagikan dengan semua orang!', zh: '写点什么和大家分享吧！', si: 'සැමට බෙදා ගැනීමට යමක් ලියන්න!', km: 'សរសេរអ្វីមួយដើម្បីចែករំលែកជាមួយអ្នករាល់គ្នា!' },
  boardFilterAll: { ja: 'すべて', en: 'All', vi: 'Tất cả', id: 'Semua', zh: '全部', si: 'සියල්ල', km: 'ទាំងអស់' },
  boardFilterWork: { ja: '業務報告', en: 'Work', vi: 'Công việc', id: 'Kerja', zh: '工作', si: 'වැඩ', km: 'ការងារ' },
  boardFilterLife: { ja: '生活情報', en: 'Life', vi: 'Đời sống', id: 'Kehidupan', zh: '生活', si: 'ජීවිතය', km: 'ជីវិត' },
  boardFilterGeneral: { ja: 'その他', en: 'Other', vi: 'Khác', id: 'Lainnya', zh: '其他', si: 'වෙනත්', km: 'ផ្សេងៗ' },
  boardSend: { ja: '送信', en: 'Send', vi: 'Gửi', id: 'Kirim', zh: '发送', si: 'යවන්න', km: 'បញ្ជូន' },
  boardDelete: { ja: '削除', en: 'Delete', vi: 'Xóa', id: 'Hapus', zh: '删除', si: 'මකන්න', km: 'លុប' },
  boardNoPosts: { ja: '表示する投稿がありません', en: 'No posts to display', vi: 'Không có bài đăng nào để hiển thị', id: 'Tidak ada postingan untuk ditampilkan', zh: '没有要显示的帖子', si: 'පෙන්වීමට පළ කිරීම් නොමැත', km: 'មិនមានការបង្ហោះដើម្បីបង្ហាញទេ' },
  
  // タイムカード関連
  tc_title: { ja: '月次タイムカード明細', en: 'Monthly Timecard', vi: 'Bảng chấm công hàng tháng', id: 'Kartu Jam Kerja Bulanan', zh: '月度打卡考勤明细', si: 'මාසික පැමිණීම් වාර්තාව', km: 'កំណត់ត្រាវត្តមានប្រចាំខែ' },
  tc_subtitle: { ja: '日々の出退勤打刻と労働時間の集計実績です', en: 'Daily attendance logs & work hour summary', vi: 'Nhật ký chấm công và tổng hợp giờ làm việc hàng ngày', id: 'Log kehadiran harian & ringkasan jam kerja', zh: '每日考勤打卡与工作时间汇总记录', si: 'දෛනික පැමිණීම් සහ වැඩ කරන පැය සාරාංශය', km: 'កំណត់ត្រាវត្តមាន និង សង្ខេបម៉ោងធ្វើការប្រចាំថ្ងៃ' },
  tc_workDays: { ja: '出勤日数', en: 'Work Days', vi: 'Số ngày làm việc', id: 'Hari Kerja', zh: '出勤天数', si: 'වැඩ කළ දින', km: 'ចំនួនថ្ងៃធ្វើការ' },
  tc_totalWorkTime: { ja: '総実働時間', en: 'Total Work Time', vi: 'Tổng thời gian làm việc', id: 'Total Jam Kerja', zh: '总实际工时', si: 'සමස්ත වැඩ කරන කාලය', km: 'ម៉ោងធ្វើការសរុប' },
  tc_overtime: { ja: '残業時間(8h超)', en: 'Overtime (>8h)', vi: 'Tăng ca (>8h)', id: 'Lembur (>8j)', zh: '加班时间(超8小时)', si: 'අතිකාල (>පැය 8)', km: 'ថែមម៉ោង (>8ម៉ោង)' },
  tc_totalBreak: { ja: '合計休憩時間', en: 'Total Break', vi: 'Tổng giờ nghỉ', id: 'Total Istirahat', zh: '合计休息时间', si: 'විවේක කාලය', km: 'ម៉ោងសម្រាកសរុប' },
  tc_dailyDetails: { ja: '日別打刻明細', en: 'Daily Records', vi: 'Chi tiết theo ngày', id: 'Rincian Harian', zh: '每日打卡明细', si: 'දෛනික වාර්තාව', km: 'ព័ត៌មានលម្អិតប្រចាំថ្ងៃ' },
  tc_date: { ja: '日付', en: 'Date', vi: 'Ngày', id: 'Tanggal', zh: '日期', si: 'දිනය', km: 'កាលបរិច្ឆេទ' },
  tc_clockIn: { ja: '出勤', en: 'In', vi: 'Vào', id: 'Masuk', zh: '上班', si: 'පැමිණීම', km: 'ចូល' },
  tc_clockOut: { ja: '退勤', en: 'Out', vi: 'Ra', id: 'Pulang', zh: '下班', si: 'පිටවීම', km: 'ចេញ' },
  tc_break: { ja: '休憩', en: 'Break', vi: 'Nghỉ', id: 'Istirahat', zh: '休息', si: 'විවේකය', km: 'សម្រាក' },
  tc_workHours: { ja: '実労働時間', en: 'Work Hours', vi: 'Giờ làm', id: 'Jam Kerja', zh: '实际工时', si: 'වැඩ කළ පැය', km: 'ម៉ោងធ្វើការ' },
  tc_status: { ja: '状態', en: 'Status', vi: 'Trạng thái', id: 'Status', zh: '状态', si: 'තත්ත්වය', km: 'ស្ថានភាព' },
  tc_completed: { ja: '完了', en: 'Done', vi: 'Hoàn thành', id: 'Selesai', zh: '完成', si: 'අවසන්', km: 'រួចរាល់' },
  tc_working: { ja: '勤務中', en: 'Working', vi: 'Đang làm', id: 'Bekerja', zh: '上班中', si: 'වැඩ කරමින්', km: 'កំពុងធ្វើការ' },
  tc_requestLeaveBtn: { ja: '🏖️ 有給・休暇を申請する', en: '🏖️ Request Leave', vi: '🏖️ Xin nghỉ phép', id: '🏖️ Ajukan Cuti', zh: '🏖️ 申请休假', si: '🏖️ නිවාඩු ඉල්ලන්න', km: '🏖️ ស្នើសុំឈប់សម្រាក' },
  tc_leaveApproved: { ja: '有給(承認)', en: 'Leave (Approved)', vi: 'Nghỉ phép (Đã duyệt)', id: 'Cuti (Disetujui)', zh: '带薪假(已批准)', si: 'නිවාඩු (අනුමතයි)', km: 'ឈប់សម្រាក (អនុម័ត)' },
  tc_leavePending: { ja: '有給(申請中)', en: 'Leave (Pending)', vi: 'Nghỉ phép (Chờ duyệt)', id: 'Cuti (Menunggu)', zh: '带薪假(申请中)', si: 'නිවාඩු (අනුමැතිය සඳහා)', km: 'ឈប់សម្រាក (កំពុងរង់ចាំ)' },
  tc_prevMonth: { ja: '◀ 前月', en: '◀ Prev', vi: '◀ Tháng trước', id: '◀ Bln Lalu', zh: '◀ 上个月', si: '◀ පෙර මාසය', km: '◀ ខែមុន' },
  tc_nextMonth: { ja: '翌月 ▶', en: 'Next ▶', vi: 'Tháng sau ▶', id: 'Bln Depan ▶', zh: '下个月 ▶', si: 'මීළඟ මාසය ▶', km: 'ខែបន្ទាប់ ▶' },
  tc_hours: { ja: '時間', en: 'h ', vi: 'h ', id: 'j ', zh: '小时', si: 'පැය ', km: 'ម៉ោង ' },
  tc_minutes: { ja: '分', en: 'm', vi: 'p', id: 'm', zh: '分', si: 'මිනිත්තු', km: 'នាទី' },
  tc_currentMonthSummary: { ja: '今月の勤務実績（当月累計）', en: 'Current Month Summary', vi: 'Tổng kết tháng này', id: 'Ringkasan Bulan Ini', zh: '本月出勤汇总', si: 'මෙම මාසයේ සාරාංශය', km: 'សង្ខេបខែនេះ' },
  tc_openDetails: { ja: 'タイムカード明細', en: 'Timecard Details', vi: 'Chi tiết bảng công', id: 'Rincian Kartu Jam', zh: '打卡明细', si: 'වාර්තා විස්තර', km: 'ព័ត៌មានលម្អិត' },
  tc_colApply: { ja: '申請', en: 'Apply', vi: 'Yêu cầu', id: 'Ajukan', zh: '申请', si: 'අයදුම්', km: 'ពាក្យស្នើសុំ' },
  tc_applyLeave: { ja: '+ 休暇申請', en: '+ Leave', vi: '+ Xin nghỉ', id: '+ Cuti', zh: '+ 请假', si: '+ නිවාඩු', km: '+ ស្នើសុំឈប់' },
  tc_requestLeaveBtnShort: { ja: '有給申請', en: 'Leave', vi: 'Xin nghỉ', id: 'Cuti', zh: '请假', si: 'නිවාඩු', km: 'សុំឈប់' },
  tc_refresh: { ja: '最新情報に更新', en: 'Refresh data', vi: 'Làm mới dữ liệu', id: 'Perbarui data', zh: '刷新数据', si: 'යාවත්කාලීන කරන්න', km: 'ធ្វើបច្ចុប្បន្នភាព' },
  tc_applyForDate: { ja: 'の休暇を申請', en: ' - Request leave', vi: ' - Xin nghỉ phép', id: ' - Ajukan cuti', zh: ' 的休假申请', si: ' නිවාඩු ඉල්ලීම', km: ' - ស្នើសុំឈប់សម្រាក' },

  // 有給・休暇申請モーダル用
  leave_modalTitle: { ja: '有給・休暇の申請', en: 'Request Paid Leave / Day Off', vi: 'Đăng ký nghỉ phép / nghỉ ngày', id: 'Pengajuan Cuti / Libur', zh: '申请带薪假/休假', si: 'වැටුප් සහිත නිවාඩු ඉල්ලීම', km: 'ពាក្យស្នើសុំឈប់សម្រាក' },
  leave_modalSub: { ja: '希望日と理由を入力して送信してください', en: 'Please enter desired date and reason to submit', vi: 'Vui lòng nhập ngày mong muốn và lý do để gửi', id: 'Silakan masukkan tanggal yang diinginkan dan alasan', zh: '请输入期望日期和理由并提交', si: 'කරුණාකර දිනය සහ හේතුව ඇතුළත් කරන්න', km: 'សូមបញ្ចូលកាលបរិច្ឆេទ និងមូលហេតុដែលចង់បាន' },
  leave_applicant: { ja: '申請者:', en: 'Applicant:', vi: 'Người nộp đơn:', id: 'Pemohon:', zh: '申请人:', si: 'අයදුම්කරු:', km: 'អ្នកស្នើសុំ:' },
  leave_selectWorker: { ja: '申請する従業員', en: 'Select Employee', vi: 'Chọn nhân viên', id: 'Pilih Karyawan', zh: '选择员工', si: 'සේවකයා තෝරන්න', km: 'ជ្រើសរើសបុគ្គលិក' },
  leave_selectWorkerPrompt: { ja: '従業員を選択してください', en: 'Please select an employee', vi: 'Vui lòng chọn nhân viên', id: 'Silakan pilih karyawan', zh: '请选择员工', si: 'කරුණාකර සේවකයෙකු තෝරන්න', km: 'សូមជ្រើសរើសបុគ្គលិកម្នាក់' },
  leave_remainingDaysLabel: { ja: '残: ', en: 'Rem: ', vi: 'Còn: ', id: 'Sisa: ', zh: '余: ', si: 'ඉතිරි: ', km: 'នៅសល់: ' },
  leave_daysRemaining: { ja: '残り {days}日', en: '{days} days remaining', vi: 'Còn lại {days} ngày', id: 'Tersisa {days} hari', zh: '剩余 {days} 天', si: 'දින {days}ක් ඉතිරියි', km: 'នៅសល់ {days} ថ្ងៃ' },
  leave_leaveType: { ja: '休暇の種類', en: 'Leave Type', vi: 'Loại nghỉ phép', id: 'Jenis Cuti', zh: '假期种类', si: 'නිවාඩු වර්ගය', km: 'ប្រភេទនៃការឈប់សម្រាក' },
  leave_typeFull: { ja: '有給休暇（全休・1日）', en: 'Paid Leave (Full Day)', vi: 'Nghỉ phép có lương (Cả ngày)', id: 'Cuti Berbayar (Seharian)', zh: '带薪休假（全天）', si: 'වැටුප් සහිත නිවාඩු (දවසම)', km: 'ឈប់សម្រាកមានប្រាក់ខែ (ពេញមួយថ្ងៃ)' },
  leave_typeAm: { ja: '午前半休（0.5日）', en: 'Morning Half-day (0.5 day)', vi: 'Nghỉ nửa ngày sáng (0.5 ngày)', id: 'Setengah Hari Pagi (0.5 hari)', zh: '上午半天假（0.5天）', si: 'උදෑසන අර්ධ නිවාඩු (දින 0.5)', km: 'ឈប់សម្រាកពេលព្រឹក (០.៥ ថ្ងៃ)' },
  leave_typePm: { ja: '午後半休（0.5日）', en: 'Afternoon Half-day (0.5 day)', vi: 'Nghỉ nửa ngày chiều (0.5 ngày)', id: 'Setengah Hari Siang (0.5 hari)', zh: '下午半天假（0.5天）', si: 'සවස අර්ධ නිවාඩු (දින 0.5)', km: 'ឈប់សម្រាកពេលរសៀល (០.៥ ថ្ងៃ)' },
  leave_typeSpecial: { ja: '特別休暇（慶弔・リフレッシュ等）', en: 'Special Leave', vi: 'Nghỉ phép đặc biệt', id: 'Cuti Khusus', zh: '特别休假', si: 'විශේෂ නිවාඩු', km: 'ការឈប់សម្រាកពិសេស' },
  leave_typeAbsence: { ja: '欠勤', en: 'Absence', vi: 'Nghỉ không lương / Vắng mặt', id: 'Izin / Tidak Masuk', zh: '缺勤', si: 'වැඩට නොපැමිණීම', km: 'អវត្តមាន' },
  leave_startDate: { ja: '開始日', en: 'Start Date', vi: 'Ngày bắt đầu', id: 'Tanggal Mulai', zh: '开始日期', si: 'ආරම්භක දිනය', km: 'កាលបរិច្ឆេទចាប់ផ្តើម' },
  leave_endDate: { ja: '終了日', en: 'End Date', vi: 'Ngày kết thúc', id: 'Tanggal Selesai', zh: '结束日期', si: 'අවසන් දිනය', km: 'កាលបរិច្ឆេទបញ្ចប់' },
  leave_reasonLabel: { ja: '申請理由・備考', en: 'Reason / Remarks', vi: 'Lý do / Ghi chú', id: 'Alasan / Keterangan', zh: '申请理由/备注', si: 'හේතුව / සටහන්', km: 'មូលហេតុ / កំណត់ចំណាំ' },
  leave_optional: { ja: '(任意)', en: '(Optional)', vi: '(Tùy chọn)', id: '(Opsional)', zh: '(选填)', si: '(විකල්ප)', km: '(ជាជម្រើស)' },
  leave_reasonPlaceholder: { ja: '例: 私用のため、通院のため、家庭の事情など', en: 'e.g. Personal reasons, hospital visit, family matter', vi: 'vd: Việc cá nhân, đi khám bệnh, việc gia đình', id: 'cth: Keperluan pribadi, ke dokter, urusan keluarga', zh: '例: 私事、就医、家庭原因等', si: 'උදා: පෞද්ගලික හේතු, රෝහල් ගතවීම', km: 'ឧ. មូលហេតុផ្ទាល់ខ្លួន ទៅពេទ្យ រឿងគ្រួសារ' },
  leave_cancel: { ja: 'キャンセル', en: 'Cancel', vi: 'Hủy', id: 'Batal', zh: '取消', si: 'අවලංගු කරන්න', km: 'បោះបង់' },
  leave_submitBtn: { ja: '申請を送信する', en: 'Submit Request', vi: 'Gửi đơn xin phép', id: 'Kirim Pengajuan', zh: '提交申请', si: 'ඉල්ලීම යවන්න', km: 'បញ្ជូនពាក្យស្នើសុំ' },
  leave_registerBtn: { ja: '有給を登録する', en: 'Register Leave', vi: 'Đăng ký nghỉ phép', id: 'Daftarkan Cuti', zh: '登记休假', si: 'නිවාඩු ලියාපදිංචි කරන්න', km: 'ចុះឈ្មោះឈប់សម្រាក' },
  leave_submittedToast: { ja: '有給休暇の申請を送信しました！', en: 'Leave request submitted successfully!', vi: 'Đã gửi đơn xin nghỉ phép thành công!', id: 'Pengajuan cuti berhasil dikirim!', zh: '请假申请已提交！', si: 'නිවාඩු ඉල්ලීම සාර්ථකව යවන ලදී!', km: 'ពាក្យស្នើសុំឈប់សម្រាកត្រូវបានបញ្ជូនដោយជោគជ័យ!' }
};

export const WEEKDAY_NAMES: Record<LanguageCode, string[]> = {
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  si: ['ඉරි', 'සඳු', 'අඟ', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන'],
  km: ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'],
};

export function getWeekdayName(dayIndex: number, lang: LanguageCode = 'ja'): string {
  const list = WEEKDAY_NAMES[lang] || WEEKDAY_NAMES['ja'];
  return list[dayIndex % 7] || '';
}

export function t(key: string, lang: LanguageCode = 'ja'): string {
  if (!TRANSLATIONS[key]) {
    console.warn(`Translation key missing: ${key}`);
    return key;
  }
  return TRANSLATIONS[key][lang] || TRANSLATIONS[key]['en'] || TRANSLATIONS[key]['ja'] || key;
}

export function getTranslatedName(item: any, lang: LanguageCode = 'ja'): string {
  if (!item) return '';
  if (lang === 'ja') return item.name || '';
  
  const langKey = `name_${lang}`;
  // 1. 専用の言語カラムがあればそれを返す
  if (item[langKey]) return item[langKey];
  // 2. 英語カラムがあればそれを返す（英語以外の言語で専用カラムがない場合でも日本語より英語が分かりやすい）
  if (lang !== 'en' && item.name_en) return item.name_en;

  // 3. 辞書・部分一致での翻訳フォールバック
  if (item.name) {
    const trans = getTranslatedWorkType(item.name, lang);
    if (trans) return trans;
    return item.name;
  }
  return '';
}

// 作業種別・タスクタイトルの多言語翻訳関数
export function getTranslatedWorkType(text: string, lang: LanguageCode = 'ja'): string {
  if (!text) return '';
  if (lang === 'ja') return text;

  // 1. 翻訳辞書に完全一致するもの
  if (TRANSLATIONS[text] && TRANSLATIONS[text][lang]) {
    return TRANSLATIONS[text][lang];
  }

  // 2. 代表的な農作業用語・テスト・圃場・作目等のキーワード辞書
  const dict: Record<string, Record<string, string>> = {
    'テスト': { en: 'Test', vi: 'Kiểm tra (Test)', id: 'Uji Coba', zh: '测试', si: 'පරීක්ෂණය', km: 'ការសាកល្បង' },
    'テスト2': { en: 'Test 2', vi: 'Kiểm tra 2', id: 'Uji Coba 2', zh: '测试2', si: 'පරීක්ෂණය 2', km: 'ការសាកល្បង 2' },
    '作業': { en: 'Work', vi: 'Công việc', id: 'Pekerjaan', zh: '作业', si: 'වැඩ', km: 'ការងារ' },
    '播種': { en: 'Sowing', vi: 'Gieo hạt', id: 'Menabur', zh: '播种', si: 'බීජ වැපිරීම', km: 'ការសាបព្រោះ' },
    '定植': { en: 'Planting', vi: 'Trồng cây', id: 'Menanam', zh: '定植', si: 'පැල සිටුවීම', km: 'ការដាំកូនឈើ' },
    '水やり': { en: 'Watering', vi: 'Tưới nước', id: 'Menyiram', zh: '浇水', si: 'වතුර දැමීම', km: 'ការស្រោចទឹក' },
    '水やり・追肥': { en: 'Watering/Fertilizing', vi: 'Tưới nước/Bón phân', id: 'Menyiram/Memupuk', zh: '浇水/追肥', si: 'වතුර දැමීම / පොහොර යෙදීම', km: 'ស្រោចទឹក / ដាក់ជី' },
    '追肥': { en: 'Fertilizing', vi: 'Bón phân', id: 'Pemupukan', zh: '追肥', si: 'පොහොර යෙදීම', km: 'ការដាក់ជី' },
    '収穫': { en: 'Harvesting', vi: 'Thu hoạch', id: 'Memanen', zh: '收获', si: 'අස්වනු නෙලීම', km: 'ការប្រមូលផល' },
    '収穫・調整': { en: 'Harvesting/Adjustment', vi: 'Thu hoạch/Điều chỉnh', id: 'Memanen/Penyesuaian', zh: '采收/分选', si: 'අස්වනු නෙලීම / සකස් කිරීම', km: 'ប្រមូលផល / កែសម្រួល' },
    '草引き': { en: 'Weeding', vi: 'Nhổ cỏ', id: 'Mencabut rumput', zh: '拔草', si: 'වල් නෙලීම', km: 'ការដកស្មៅ' },
    '草刈り': { en: 'Mowing', vi: 'Cắt cỏ', id: 'Membabat rumput', zh: '除草', si: 'තණකොළ කැපීම', km: 'ការកាត់ស្មៅ' },
    '除草': { en: 'Weeding', vi: 'Diệt cỏ', id: 'Pengendalian gulma', zh: '除草', si: 'වල් මර්දනය', km: 'ការកម្ចាត់ស្មៅ' },
    '草引き・防除': { en: 'Weeding/Pest control', vi: 'Làm cỏ/Kiểm soát dịch hại', id: 'Menyiangi/Pengendalian hama', zh: '除草/病虫害防治', si: 'වල් නෙලීම / පළිබෝධ පාලනය', km: 'ដកស្មៅ / កម្ចាត់សត្វល្អិត' },
    '防除': { en: 'Pest Control', vi: 'Phòng trừ sâu bệnh', id: 'Pengendalian Hama', zh: '病虫防治', si: 'පළිබෝධ පාලනය', km: 'ការគ្រប់គ្រងសត្វល្អិត' },
    '消毒': { en: 'Disinfection', vi: 'Khử trùng / Phun thuốc', id: 'Disinfeksi', zh: '消毒', si: 'විෂබීජහරණය', km: 'ការសម្លាប់មេរោគ' },
    '片付け': { en: 'Cleanup', vi: 'Dọn dẹp', id: 'Pembersihan', zh: '清理', si: 'පිරිසිදු කිරීම', km: 'ការសម្អាត' },
    '片付け・その他': { en: 'Cleanup/Other', vi: 'Dọn dẹp/Khác', id: 'Pembersihan/Lainnya', zh: '整理/其他', si: 'පිරිසිදු කිරීම / වෙනත්', km: 'ការសម្អាត / ផ្សេងៗ' },
    '出荷': { en: 'Shipping', vi: 'Xuất hàng', id: 'Pengiriman', zh: '发货', si: 'නැව්ගත කිරීම', km: 'ការដឹកជញ្ជូន' },
    '選別': { en: 'Sorting', vi: 'Phân loại', id: 'Sortir', zh: '分选', si: 'වර්ග කිරීම', km: 'ការតម្រៀប' },
    '袋詰め': { en: 'Bagging / Packing', vi: 'Đóng gói túi', id: 'Pengemasan', zh: '装袋打包', si: 'ඇසුරුම් කිරීම', km: 'ការវេចខ្ចប់' },
    // 代表的な作物
    'モロヘイヤ': { en: 'Molokhia', vi: 'Rau đay', id: 'Daun Molokhia', zh: '埃及野麻婴', si: 'මොරොහෙයියා', km: 'ម៉ូរ៉ូហ៊ីយ៉ា' },
    'きゅうり': { en: 'Cucumber', vi: 'Dưa leo', id: 'Mentimun', zh: '黄瓜', si: 'පිපිඤ්ඤා', km: 'ត្រសក់' },
    '枝豆': { en: 'Edamame', vi: 'Đậu nành non', id: 'Edamame', zh: '毛豆', si: 'එඩමාමේ', km: 'សណ្តែកសៀង' },
    'トマト': { en: 'Tomato', vi: 'Cà chua', id: 'Tomat', zh: '番茄', si: 'තක්කාලි', km: 'ប៉េងប៉ោះ' },
    'ミニトマト': { en: 'Cherry Tomato', vi: 'Cà chua bi', id: 'Tomat Ceri', zh: '圣女果', si: 'චෙරි තක්කාලි', km: 'ប៉េងប៉ោះតូច' },
    'いちご': { en: 'Strawberry', vi: 'Dâu tây', id: 'Stroberi', zh: '草莓', si: 'ස්ට්‍රෝබෙරි', km: 'ផ្លែស្ត្របឺរី' },
    'ナス': { en: 'Eggplant', vi: 'Cà tím', id: 'Terong', zh: '茄子', si: 'වම්බටු', km: 'ត្រប់' },
    'なす': { en: 'Eggplant', vi: 'Cà tím', id: 'Terong', zh: '茄子', si: 'වම්බටු', km: 'ត្រប់' },
    'ピーマン': { en: 'Bell Pepper', vi: 'Ớt chuông xanh', id: 'Paprika Hijau', zh: '青椒', si: 'බෙල් පෙපර්', km: 'ម្ទេសប្លោក' },
    // 圃場・棟
    '露地': { en: 'Open Field', vi: 'Đất trống', id: 'Ladang Terbuka', zh: '露天田地', si: 'එළිමහන් ක්ෂේත්‍රය', km: 'វាលស្រែបើកចំហ' },
    'ハウス': { en: 'Greenhouse', vi: 'Nhà kính', id: 'Rumah Kaca', zh: '温室大棚', si: 'හරිතාගාරය', km: 'ផ្ទះកញ្ចក់' },
    'D棟': { en: 'Building D', vi: 'Nhà D', id: 'Gedung D', zh: 'D栋', si: 'D ගොඩනැගිල්ල', km: 'អាគារ D' },
    'A棟': { en: 'Building A', vi: 'Nhà A', id: 'Gedung A', zh: 'A栋', si: 'A ගොඩනැගිල්ල', km: 'អាគារ A' },
    'B棟': { en: 'Building B', vi: 'Nhà B', id: 'Gedung B', zh: 'B栋', si: 'B ගොඩනැගිල්ල', km: 'អាគារ B' },
    'C棟': { en: 'Building C', vi: 'Nhà C', id: 'Gedung C', zh: 'C栋', si: 'C ගොඩනැගිල්ල', km: 'អាគារ C' },
    '南側': { en: 'South', vi: 'Phía Nam', id: 'Selatan', zh: '南侧', si: 'දකුණු පස', km: 'ខាងត្បូង' },
    '北側': { en: 'North', vi: 'Phía Bắc', id: 'Utara', zh: '北侧', si: 'උතුරු පස', km: 'ខាងជើង' },
    '東側': { en: 'East', vi: 'Phía Đông', id: 'Timur', zh: '东侧', si: 'නැගෙනහිර පස', km: 'ខាងកើត' },
    '西側': { en: 'West', vi: 'Phía Tây', id: 'Barat', zh: '西侧', si: 'බටහිර පස', km: 'ខាងលិច' },
  };

  if (dict[text] && dict[text][lang]) {
    return dict[text][lang];
  }

  // テスト1, テスト 2 などの正規表現対応
  const testMatch = text.match(/^テスト\s*([0-9０-９]+)$/);
  if (testMatch) {
    const num = testMatch[1];
    const prefix = dict['テスト']?.[lang] || 'Test';
    return `${prefix} ${num}`;
  }

  // 部分一致照合（長い単語から順に置換）
  let result = text;
  let replaced = false;
  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (result.includes(key) && dict[key][lang]) {
      result = result.replaceAll(key, dict[key][lang]);
      replaced = true;
    }
  }

  if (replaced) return result;

  return text;
}

export const UNIT_DICTIONARY: Record<string, Record<LanguageCode, string>> = {
  'kg': { ja: 'kg', en: 'kg', vi: 'kg', id: 'kg', zh: 'kg', si: 'kg', km: 'kg' },
  '袋': { ja: '袋', en: 'Bag', vi: 'Túi', id: 'Kantong', zh: '袋', si: 'මල්ල', km: 'ថង់' },
  '箱': { ja: '箱', en: 'Box', vi: 'Hộp', id: 'Kotak', zh: '箱', si: 'පෙට්ටිය', km: 'ប្រអប់' },
  'パック': { ja: 'パック', en: 'Pack', vi: 'Vỉ/Gói', id: 'Pak', zh: '包/盒', si: 'පැක්', km: 'កញ្ចប់' },
  '本': { ja: '本', en: 'Pcs', vi: 'Cây/Củ', id: 'Batang', zh: '根/条', si: 'කඳ', km: 'ដើម' },
  '個': { ja: '個', en: 'Pcs', vi: 'Trái/Quả', id: 'Buah', zh: '个', si: 'ගෙඩි', km: 'គ្រាប់' },
  '束': { ja: '束', en: 'Bundle', vi: 'Bó', id: 'Ikat', zh: '束', si: 'මිටිය', km: 'បាច់' },
  'ケース': { ja: 'ケース', en: 'Case', vi: 'Thùng', id: 'Kasus', zh: '箱', si: 'කේස්', km: 'កេស' },
  'トレー': { ja: 'トレー', en: 'Tray', vi: 'Khay', id: 'Baki', zh: '托盘', si: 'තැටි', km: 'ថាស' },
  'コンテナ': { ja: 'コンテナ', en: 'Container', vi: 'Sọt/Công', id: 'Kontainer', zh: '筐', si: 'බහාලුම', km: 'កុងតឺន័រ' },
  'g': { ja: 'g', en: 'g', vi: 'g', id: 'g', zh: 'g', si: 'g', km: 'g' },
};

export const UNITS = [
  'kg', '袋', '箱', 'パック', '本', '個', '束', 'ケース', 'トレー', 'コンテナ', 'g'
];

export function getTranslatedUnit(unit: string, lang: LanguageCode = 'ja'): string {
  if (!unit) return '';
  if (lang === 'ja') return unit;
  if (UNIT_DICTIONARY[unit] && UNIT_DICTIONARY[unit][lang]) {
    const trans = UNIT_DICTIONARY[unit][lang];
    return trans === unit ? unit : `${unit} (${trans})`;
  }
  return unit;
}

