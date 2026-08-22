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
  // 共通
  startWork: { ja: '作業を開始する',
    en: 'Start Work',
    vi: 'Bắt đầu công việc',
    id: 'Mulai Kerja',
    zh: '开始工作' , si: 'වැඩ ආරම්භ කරන්න', km: 'ចាប់ផ្តើមធ្វើការ' },
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
  lineNotifyDesc: { ja: '退勤忘れ時に通知が届きます', en: 'You will be notified if you forget to clock out', vi: 'Bạn sẽ được thông báo nếu quên chấm công ra', id: 'Anda akan diberitahu jika lupa absen pulang', zh: '如果您忘记下班打卡将会收到通知', si: 'වැඩ නිම කිරීමට අමතක වුවහොත් දැනුම් දෙනු ලැබේ', km: 'អ្នកនឹងត្រូវបានជូនដំណឹងប្រសិនបើអ្នកភ្លេចថតម៉ោងចេញ' }
};

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
  // 翻訳名が存在すればそれを返し、なければ英語名、それでもなければ日本語名をフォールバックとして返す
  return item[langKey] || item.name_en || item.name || '';
}
