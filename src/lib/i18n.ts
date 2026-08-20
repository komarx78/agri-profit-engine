export type LanguageCode = 'ja' | 'en' | 'vi' | 'id' | 'zh';

export const LANGUAGES = [
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export const TRANSLATIONS: Record<string, Record<LanguageCode, string>> = {
  // 共通
  startWork: {
    ja: '作業を開始する',
    en: 'Start Work',
    vi: 'Bắt đầu công việc',
    id: 'Mulai Kerja',
    zh: '开始工作',
  },
  stopWork: {
    ja: '作業を完了する',
    en: 'Finish Work',
    vi: 'Hoàn thành công việc',
    id: 'Selesai Kerja',
    zh: '完成工作',
  },
  save: {
    ja: '保存',
    en: 'Save',
    vi: 'Lưu',
    id: 'Simpan',
    zh: '保存',
  },
  cancel: {
    ja: 'キャンセル',
    en: 'Cancel',
    vi: 'Hủy',
    id: 'Batal',
    zh: '取消',
  },
  memo: {
    ja: 'メモ (任意)',
    en: 'Memo (Optional)',
    vi: 'Ghi chú (Tùy chọn)',
    id: 'Catatan (Opsional)',
    zh: '备注 (可选)',
  },
  memoPlaceholder: {
    ja: '気づいたことなど...',
    en: 'Anything you noticed...',
    vi: 'Bất cứ điều gì bạn nhận thấy...',
    id: 'Apa pun yang Anda perhatikan...',
    zh: '您注意到的任何事情...',
  },
  
  // 現場アプリ - タブ・入力
  tabTimer: {
    ja: 'タイマー記録',
    en: 'Timer',
    vi: 'Đồng hồ đếm giờ',
    id: 'Pengatur Waktu',
    zh: '计时器',
  },
  tabManual: {
    ja: '手入力記録',
    en: 'Manual Entry',
    vi: 'Nhập thủ công',
    id: 'Entri Manual',
    zh: '手动输入',
  },
  tabManuals: {
    ja: 'マニュアル',
    en: 'Manuals',
    vi: 'Sổ tay hướng dẫn',
    id: 'Panduan',
    zh: '手册',
  },
  
  // 項目ラベル
  worker: {
    ja: '作業者',
    en: 'Worker',
    vi: 'Công nhân',
    id: 'Pekerja',
    zh: '工人',
  },
  crop: {
    ja: '作目',
    en: 'Crop',
    vi: 'Cây trồng',
    id: 'Tanaman',
    zh: '作物',
  },
  field: {
    ja: '圃場 (作業場所)',
    en: 'Field (Location)',
    vi: 'Cánh đồng (Địa điểm)',
    id: 'Ladang (Lokasi)',
    zh: '田地 (位置)',
  },
  workType: {
    ja: '作業内容',
    en: 'Work Type',
    vi: 'Loại công việc',
    id: 'Jenis Pekerjaan',
    zh: '工作类型',
  },
  material: {
    ja: '使用資材 (任意)',
    en: 'Material (Optional)',
    vi: 'Vật liệu (Tùy chọn)',
    id: 'Material (Opsional)',
    zh: '材料 (可选)',
  },
  amount: {
    ja: '使用量 (任意)',
    en: 'Amount (Optional)',
    vi: 'Số lượng (Tùy chọn)',
    id: 'Jumlah (Opsional)',
    zh: '数量 (可选)',
  },
  photo: {
    ja: '写真を添付 (任意)',
    en: 'Attach Photo (Optional)',
    vi: 'Đính kèm ảnh (Tùy chọn)',
    id: 'Lampirkan Foto (Opsional)',
    zh: '附加照片 (可选)',
  },
  video: {
    ja: '動画を添付 (任意)',
    en: 'Attach Video (Optional)',
    vi: 'Đính kèm video (Tùy chọn)',
    id: 'Lampirkan Video (Opsional)',
    zh: '附加视频 (可选)',
  },
  
  // メッセージ
  workingNow: {
    ja: '作業中...',
    en: 'Working...',
    vi: 'Đang làm việc...',
    id: 'Sedang bekerja...',
    zh: '工作中...',
  },
  recordingComplete: {
    ja: '記録完了！',
    en: 'Recording Complete!',
    vi: 'Ghi âm hoàn tất!',
    id: 'Perekaman Selesai!',
    zh: '记录完成！',
  },
  goodJob: {
    ja: 'お疲れ様でした！🌱',
    en: 'Good job! 🌱',
    vi: 'Làm tốt lắm! 🌱',
    id: 'Kerja bagus! 🌱',
    zh: '干得好！🌱',
  },
  selectRequired: {
    ja: '選択してください',
    en: 'Please select',
    vi: 'Vui lòng chọn',
    id: 'Silakan pilih',
    zh: '请选择',
  },
  
  // 動画マニュアル関連
  videoManuals: {
    ja: '動画マニュアル集', en: 'Video Manuals', vi: 'Hướng dẫn bằng video', id: 'Manual Video', zh: '视频手册'
  },
  noManuals: {
    ja: '現在登録されているマニュアルはありません', en: 'No manuals currently registered', vi: 'Hiện không có hướng dẫn nào được đăng ký', id: 'Tidak ada manual yang terdaftar saat ini', zh: '目前没有注册的手册'
  },
  // 出荷記録関連
  salesRecord: {
    ja: '出荷記録', en: 'Sales Record', vi: 'Ghi nhận xuất hàng', id: 'Catatan Penjualan', zh: '发货记录'
  },
  autoCalcDesc: {
    ja: '数量だけ入れて自動計算！', en: 'Auto calculated just by entering quantity!', vi: 'Tự động tính toán chỉ bằng cách nhập số lượng!', id: 'Dihitung otomatis hanya dengan memasukkan jumlah!', zh: '只需输入数量即可自动计算！'
  },
  salesCompleted: {
    ja: '出荷記録完了！', en: 'Sales Record Completed!', vi: 'Hoàn thành ghi nhận xuất hàng!', id: 'Catatan Penjualan Selesai!', zh: '发货记录完成！'
  },
  salesAutoCalculated: {
    ja: '売上も自動計算されました🚚', en: 'Sales calculated automatically🚚', vi: 'Doanh thu cũng được tính tự động🚚', id: 'Penjualan juga dihitung secara otomatis🚚', zh: '销售额也已自动计算🚚'
  },
  salesChannel: {
    ja: '出荷先', en: 'Sales Channel', vi: 'Nơi xuất hàng', id: 'Saluran Penjualan', zh: '出货方'
  },
  selectCropFirst: {
    ja: '先に作目を選択してください', en: 'Please select a crop first', vi: 'Vui lòng chọn loại cây trồng trước', id: 'Silakan pilih tanaman terlebih dahulu', zh: '请先选择作物'
  },
  noPriceMaster: {
    ja: 'この作目の販売価格マスタが登録されていません。', en: 'Sales price master for this crop is not registered.', vi: 'Bảng giá cho loại cây trồng này chưa được đăng ký.', id: 'Master harga jual untuk tanaman ini belum terdaftar.', zh: '未注册该作物的销售价格主数据。'
  },
  quantityRequired: {
    ja: '出荷量・数 (必須)', en: 'Quantity (Required)', vi: 'Số lượng xuất (Bắt buộc)', id: 'Kuantitas (Wajib)', zh: '发货量/数量 (必填)'
  },
  appliedPrice: {
    ja: '適用単価', en: 'Applied Unit Price', vi: 'Đơn giá áp dụng', id: 'Harga Satuan Diterapkan', zh: '适用单价'
  },
  editable: {
    ja: '手動変更可', en: 'Editable', vi: 'Có thể chỉnh sửa thủ công', id: 'Dapat diedit', zh: '可手动更改'
  },
  unit: {
    ja: '単位', en: 'Unit', vi: 'Đơn vị', id: 'Satuan', zh: '单位'
  },
  actualSales: {
    ja: '売上実績 (自動計算)', en: 'Actual Sales (Auto Calc)', vi: 'Doanh thu thực tế (Tự động)', id: 'Penjualan Aktual (Hitung Otomatis)', zh: '实际销售额 (自动计算)'
  },
  saveSalesRecord: {
    ja: '出荷記録を保存する', en: 'Save Sales Record', vi: 'Lưu ghi nhận xuất hàng', id: 'Simpan Catatan Penjualan', zh: '保存发货记录'
  },
  loadingData: {
    ja: 'データ取得中...', en: 'Loading data...', vi: 'Đang tải dữ liệu...', id: 'Memuat data...', zh: '正在加载数据...'
  },
  
  // エラー・その他
  pinRequired: {
    ja: 'PINコードを入力',
    en: 'Enter PIN code',
    vi: 'Nhập mã PIN',
    id: 'Masukkan kode PIN',
    zh: '输入 PIN 码',
  },
  login: {
    ja: 'ログイン',
    en: 'Login',
    vi: 'Đăng nhập',
    id: 'Masuk',
    zh: '登录',
  },
  
  // page.tsx (ルートページ) 専用
  workRecord: {
    ja: '作業記録', en: 'Work Record', vi: 'Ghi nhận công việc', id: 'Catatan Kerja', zh: '工作记录'
  },
  goodWork: {
    ja: 'お疲れ様です', en: 'Good work', vi: 'Làm tốt lắm', id: 'Kerja bagus', zh: '辛苦了'
  },
  currentlyWorking: {
    ja: '現在作業中...', en: 'Currently working...', vi: 'Hiện đang làm việc...', id: 'Sedang bekerja...', zh: '目前正在工作...'
  },
  noMaterial: {
    ja: '資材を選ばない', en: 'No material', vi: 'Không có vật liệu', id: 'Tidak ada material', zh: '不选材料'
  },
  minute: {
    ja: '分', en: 'min', vi: 'phút', id: 'menit', zh: '分钟'
  },
  // WorkerGate用
  workerLogin: {
    ja: '現場ログイン', en: 'Worker Login', vi: 'Đăng nhập nhân viên', id: 'Login Pekerja', zh: '工人登录'
  },
  yourName: {
    ja: 'お名前', en: 'Your Name', vi: 'Tên của bạn', id: 'Nama Anda', zh: '您的名字'
  },
  selectNamePrompt: {
    ja: '自分の名前と暗証番号を入力してください', en: 'Enter your name and PIN', vi: 'Nhập tên và mã PIN của bạn', id: 'Masukkan nama dan PIN Anda', zh: '输入您的名字和 PIN'
  },
  selectName: {
    ja: '名前を選択してください', en: 'Please select your name', vi: 'Vui lòng chọn tên của bạn', id: 'Silakan pilih nama Anda', zh: '请选择您的名字'
  },
  yourPin: {
    ja: '暗証番号 (4桁)', en: 'PIN (4 digits)', vi: 'Mã PIN (4 chữ số)', id: 'PIN (4 digit)', zh: 'PIN (4 位数字)'
  },
  pinHint: {
    ja: '※初期設定は「0000」です', en: '* Default is "0000"', vi: '* Mặc định là "0000"', id: '* Bawaan adalah "0000"', zh: '* 默认为“0000”'
  },
  incorrectPin: {
    ja: '暗証番号が間違っています。', en: 'Incorrect PIN.', vi: 'Mã PIN không đúng.', id: 'PIN salah.', zh: 'PIN 错误。'
  },
  loginFailed: {
    ja: 'ログインに失敗しました。', en: 'Login failed.', vi: 'Đăng nhập thất bại.', id: 'Gagal masuk.', zh: '登录失败。'
  },
  loginAndStart: {
    ja: 'ログインして作業開始', en: 'Login & Start Work', vi: 'Đăng nhập & Bắt đầu làm việc', id: 'Login & Mulai Kerja', zh: '登录并开始工作'
  },
  
  // 作業内容（固定）
  '収穫': {
    ja: '収穫', en: 'Harvest', vi: 'Thu hoạch', id: 'Panen', zh: '收获'
  },
  '定植・播種': {
    ja: '定植・播種', en: 'Planting / Sowing', vi: 'Trồng / Gieo hạt', id: 'Menanam / Menyemai', zh: '定植/播种'
  },
  '水やり': {
    ja: '水やり', en: 'Watering', vi: 'Tưới nước', id: 'Menyiram', zh: '浇水'
  },
  '肥料・農薬': {
    ja: '肥料・農薬', en: 'Fertilizer / Pesticide', vi: 'Phân bón / Thuốc trừ sâu', id: 'Pupuk / Pestisida', zh: '肥料/农药'
  },
  '草刈り': {
    ja: '草刈り', en: 'Weeding / Mowing', vi: 'Cắt cỏ', id: 'Membabat rumput', zh: '除草'
  },
  '片付け・メンテ': {
    ja: '片付け・メンテ', en: 'Cleanup / Maintenance', vi: 'Dọn dẹp / Bảo trì', id: 'Pembersihan / Perawatan', zh: '清理/维护'
  },
  // 勤怠関連の新規追加分
  attendance: { ja: '勤怠打刻', en: 'Attendance', vi: 'Chấm công', id: 'Kehadiran', zh: '考勤打卡' },
  realtimeRecord: { ja: 'リアルタイム記録', en: 'Realtime Record', vi: 'Ghi thời gian thực', id: 'Rekam Waktu Nyata', zh: '实时记录' },
  manualRecord: { ja: 'あとから記録', en: 'Manual Record', vi: 'Ghi thủ công', id: 'Rekam Manual', zh: '手动记录' },
  workingTime: { ja: '作業時間 (分)', en: 'Working Time (min)', vi: 'Thời gian làm việc (phút)', id: 'Waktu Kerja (menit)', zh: '工作时间 (分钟)' },
  working: { ja: '作業中', en: 'Working', vi: 'Đang làm việc', id: 'Sedang Bekerja', zh: '正在工作' },
  minutes: { ja: '分', en: 'min', vi: 'phút', id: 'menit', zh: '分钟' },
  clockIn: { ja: '出勤', en: 'Clock In', vi: 'Vào làm', id: 'Masuk Kerja', zh: '上班' },
  clockOut: { ja: '退勤', en: 'Clock Out', vi: 'Tan làm', id: 'Pulang Kerja', zh: '下班' },
  breakStart: { ja: '休憩開始', en: 'Start Break', vi: 'Bắt đầu nghỉ', id: 'Mulai Istirahat', zh: '开始休息' },
  breakEnd: { ja: '休憩を終了して戻る', en: 'End Break', vi: 'Kết thúc nghỉ', id: 'Selesai Istirahat', zh: '结束休息' },
  statusNotStarted: { ja: '未出勤', en: 'Not Started', vi: 'Chưa vào làm', id: 'Belum Mulai', zh: '未上班' },
  statusWorking: { ja: '勤務中', en: 'Working', vi: 'Đang làm việc', id: 'Sedang Bekerja', zh: '工作中' },
  statusBreak: { ja: '休憩中', en: 'On Break', vi: 'Đang nghỉ', id: 'Sedang Istirahat', zh: '休息中' },
  statusFinished: { ja: '退勤済', en: 'Finished', vi: 'Đã tan làm', id: 'Selesai', zh: '已下班' },
  weatherInfo: { ja: '天候', en: 'Weather', vi: 'Thời tiết', id: 'Cuaca', zh: '天气' },
  systemTitle: { ja: '現場システム', en: 'Field System', vi: 'Hệ thống hiện trường', id: 'Sistem Lapangan', zh: '现场系统' },
};

export function t(key: string, lang: LanguageCode = 'ja'): string {
  if (!TRANSLATIONS[key]) {
    console.warn(`Translation key missing: ${key}`);
    return key;
  }
  return TRANSLATIONS[key][lang] || TRANSLATIONS[key]['ja'];
}

export function getTranslatedName(item: any, lang: LanguageCode = 'ja'): string {
  if (!item) return '';
  if (lang === 'ja') return item.name || '';
  
  const langKey = `name_${lang}`;
  // 翻訳名が存在すればそれを返し、なければ日本語名をフォールバックとして返す
  return item[langKey] || item.name || '';
}
