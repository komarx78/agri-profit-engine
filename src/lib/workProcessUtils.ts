/**
 * 農業業務管理（作業工程分類・準備片付け分析・人件費/労働時間按分）共通ユーティリティ
 */

export type ProcessCategory = 'direct' | 'care' | 'prep_cleanup';

export interface ProcessCategoryMeta {
  key: ProcessCategory;
  label: string;
  shortLabel: string;
  badgeClass: string;
  barClass: string;
  colorHex: string;
  description: string;
}

export const PROCESS_CATEGORY_META: Record<ProcessCategory, ProcessCategoryMeta> = {
  direct: {
    key: 'direct',
    label: '🟢 直接利益を生む作業（播種・定植・収穫・出荷）',
    shortLabel: '🟢 直接利益作業',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    barClass: 'bg-emerald-500',
    colorHex: '#10b981',
    description: '種まき・苗植え・収穫・出荷調整など、売上に直結するコア作業'
  },
  care: {
    key: 'care',
    label: '🟡 育成・維持管理（水やり・防除・追肥・管理）',
    shortLabel: '🟡 育成・管理',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    barClass: 'bg-amber-400',
    colorHex: '#f59e0b',
    description: '水やり・追肥・農薬散布・芽かき・誘引など、生育を支える管理作業'
  },
  prep_cleanup: {
    key: 'prep_cleanup',
    label: '🔴 準備・片付け・非生産作業（短縮・外注対象）',
    shortLabel: '🔴 準備・片付け等',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    barClass: 'bg-rose-500',
    colorHex: '#f43f5e',
    description: '準備・段取り・片付け・掃除・草刈り・移動・機械メンテなど、短縮・外部化すべき作業'
  }
};

/**
 * 作業内容（work_type）から3大工程カテゴリを自動判定する
 */
export function classifyWorkProcess(workType: string | null | undefined): ProcessCategory {
  const raw = String(workType || '').trim();
  if (!raw) return 'care';

  // 🔴 準備・片付け・非生産作業（最優先で判定）
  if (
    raw.includes('準備') ||
    raw.includes('段取') ||
    raw.includes('片付') ||
    raw.includes('掃除') ||
    raw.includes('清掃') ||
    raw.includes('メンテ') ||
    raw.includes('移動') ||
    raw.includes('運搬') ||
    raw.includes('草刈') ||
    raw.includes('除草') ||
    raw.includes('草引') ||
    raw.includes('残渣') ||
    raw.includes('マルチ剥がし') ||
    raw.includes('マルチはがし')
  ) {
    return 'prep_cleanup';
  }

  // 🟢 直接利益を生む作業（播種・定植・収穫・出荷・袋詰め）
  if (
    raw.includes('収穫') ||
    raw.includes('播種') ||
    raw.includes('種まき') ||
    raw.includes('たねまき') ||
    raw.includes('定植') ||
    raw.includes('苗植') ||
    raw.includes('植付') ||
    raw.includes('出荷') ||
    raw.includes('袋詰') ||
    raw.includes('箱詰') ||
    raw.includes('選別') ||
    raw.includes('荷造') ||
    raw.includes('パック')
  ) {
    return 'direct';
  }

  // 🟡 その他は育成・維持管理作業
  return 'care';
}

/**
 * 現場入力用の3分類作業プリセット
 */
export const FIELD_WORK_PROCESS_GROUPS: Array<{
  category: ProcessCategory;
  title: string;
  subtitle: string;
  headerColor: string;
  activeBtnClass: string;
  items: Array<{ name: string; emoji: string }>;
}> = [
  {
    category: 'direct',
    title: '🟢 直接利益を生む作業（メイン工程）',
    subtitle: '売上に直結する最優先の作業',
    headerColor: 'text-emerald-300',
    activeBtnClass: 'bg-emerald-400 text-emerald-950 border-2 border-white shadow-md scale-[1.02]',
    items: [
      { name: '収穫', emoji: '🧺' },
      { name: '播種', emoji: '🌱' },
      { name: '定植', emoji: '🌿' },
      { name: '出荷・袋詰め', emoji: '📦' }
    ]
  },
  {
    category: 'care',
    title: '🟡 育成・維持管理作業',
    subtitle: '作物を育てるための管理工程',
    headerColor: 'text-amber-300',
    activeBtnClass: 'bg-amber-400 text-amber-950 border-2 border-white shadow-md scale-[1.02]',
    items: [
      { name: '水やり', emoji: '💧' },
      { name: '芽かき・誘引', emoji: '✂️' },
      { name: '肥料・農薬', emoji: '🧪' },
      { name: '畝立て・マルチ', emoji: '🚜' }
    ]
  },
  {
    category: 'prep_cleanup',
    title: '🔴 準備・片付け・非生産作業（時間短縮ターゲット）',
    subtitle: '記録して翌年の段取り改善・短縮に活かす作業',
    headerColor: 'text-rose-300',
    activeBtnClass: 'bg-rose-400 text-rose-950 border-2 border-white shadow-md scale-[1.02]',
    items: [
      { name: '準備・段取り', emoji: '🛠️' },
      { name: '片付け・メンテ', emoji: '🧹' },
      { name: '草刈り', emoji: '🌾' },
      { name: '移動・運搬', emoji: '🚚' }
    ]
  }
];
