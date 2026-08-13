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
  
  // マニュアル機能
  videoManuals: {
    ja: '動画マニュアル集',
    en: 'Video Manuals',
    vi: 'Hướng dẫn bằng video',
    id: 'Panduan Video',
    zh: '视频手册',
  },
  noManuals: {
    ja: '現在登録されているマニュアルはありません',
    en: 'No manuals currently registered',
    vi: 'Hiện không có hướng dẫn nào được đăng ký',
    id: 'Tidak ada panduan yang terdaftar saat ini',
    zh: '当前没有注册的手册',
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
