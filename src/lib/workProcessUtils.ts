/**
 * 農業業務管理（6大作業工程・信号機PDCA・手こずり補足解析・人件費/労働時間按分）共通ユーティリティ
 */

export type ProcessCategory = 'direct' | 'care' | 'prep_cleanup';

export type SixStageKey = 'prep' | 'soil' | 'planting' | 'care' | 'harvest' | 'cleanup';

export interface ProcessCategoryMeta {
  key: ProcessCategory;
  label: string;
  shortLabel: string;
  badgeClass: string;
  barClass: string;
  colorHex: string;
  description: string;
}

export interface SixStageMeta {
  key: SixStageKey;
  stepNumber: number;
  label: string;
  shortLabel: string;
  icon: string;
  category: ProcessCategory;
  defaultBenchmarkHoursPer10a: number;
  description: string;
  presetWorkTypes: string[];
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
    description: '準備・段取り・土づくり・片付け・草刈り・移動など、短縮・外部化すべき作業'
  }
};

/**
 * 農業の6大工程レーン定義（①準備 ➔ ②耕起・土づくり ➔ ③定植・種まき ➔ ④管理 ➔ ⑤収穫・出荷 ➔ ⑥片付け）
 */
export const SIX_STAGES_ORDER: SixStageKey[] = ['prep', 'soil', 'planting', 'care', 'harvest', 'cleanup'];

export const SIX_STAGE_META: Record<SixStageKey, SixStageMeta> = {
  prep: {
    key: 'prep',
    stepNumber: 1,
    label: '① 準備・段取り',
    shortLabel: '①準備',
    icon: '🛠️',
    category: 'prep_cleanup',
    defaultBenchmarkHoursPer10a: 4,
    description: '資材準備・苗準備・機械点検・段取り・移動',
    presetWorkTypes: ['準備・段取り', '資材・苗準備', '移動・運搬']
  },
  soil: {
    key: 'soil',
    stepNumber: 2,
    label: '② 耕起・土づくり',
    shortLabel: '②土づくり',
    icon: '🚜',
    category: 'prep_cleanup',
    defaultBenchmarkHoursPer10a: 6,
    description: '深耕・反転・耕起・元肥・畝立て・マルチ張り・水田の水平均平・代かき',
    presetWorkTypes: ['耕起・深耕・反転', '畝立て・マルチ', '水田の水平調整・代かき', '元肥・土づくり']
  },
  planting: {
    key: 'planting',
    stepNumber: 3,
    label: '③ 定植・種まき',
    shortLabel: '③定植・播種',
    icon: '🌱',
    category: 'direct',
    defaultBenchmarkHoursPer10a: 10,
    description: '播種（種まき）・定植（苗植え）・田植え（※直接利益を生む起点）',
    presetWorkTypes: ['播種', '定植', '田植え・植付']
  },
  care: {
    key: 'care',
    stepNumber: 4,
    label: '④ 育成・管理',
    shortLabel: '④管理',
    icon: '💧',
    category: 'care',
    defaultBenchmarkHoursPer10a: 15,
    description: '水やり・追肥・農薬散布（防除）・芽かき・誘引・除草・草刈り',
    presetWorkTypes: ['水やり', '芽かき・誘引', '肥料・農薬', '草刈り']
  },
  harvest: {
    key: 'harvest',
    stepNumber: 5,
    label: '⑤ 収穫・出荷',
    shortLabel: '⑤収穫・出荷',
    icon: '🧺',
    category: 'direct',
    defaultBenchmarkHoursPer10a: 25,
    description: '収穫・選別・袋詰め・箱詰め・出荷（※直接利益を生む最重要工程）',
    presetWorkTypes: ['収穫', '出荷・袋詰め']
  },
  cleanup: {
    key: 'cleanup',
    stepNumber: 6,
    label: '⑥ 片付け・撤去',
    shortLabel: '⑥片付け',
    icon: '🧹',
    category: 'prep_cleanup',
    defaultBenchmarkHoursPer10a: 6,
    description: '残渣処理・マルチ剥がし・支柱/ネット撤去・ハウス清掃（※臨時雇用での短期圧縮ターゲット）',
    presetWorkTypes: ['片付け・メンテ', '残渣処理・マルチ剥がし', '支柱・ネット撤去']
  }
};

/**
 * 作業内容（work_type / task_title）から6大工程を自動判定する
 */
export function classifySixStage(workType: string | null | undefined): SixStageKey {
  const raw = String(workType || '').trim();
  if (!raw) return 'care';

  // ⑥ 片付け・撤去
  if (
    raw.includes('片付') ||
    raw.includes('残渣') ||
    raw.includes('撤去') ||
    raw.includes('マルチ剥がし') ||
    raw.includes('マルチはがし') ||
    raw.includes('掃除') ||
    raw.includes('清掃')
  ) {
    return 'cleanup';
  }

  // ② 耕起・土づくり（深耕・水平調整・畝立て・マルチ・代かき・元肥）
  if (
    raw.includes('耕起') ||
    raw.includes('深耕') ||
    raw.includes('反転') ||
    raw.includes('土づくり') ||
    raw.includes('土作り') ||
    raw.includes('水平') ||
    raw.includes('均平') ||
    raw.includes('クレーター') ||
    raw.includes('代かき') ||
    raw.includes('代掻き') ||
    raw.includes('畝立') ||
    raw.includes('うね立') ||
    raw.includes('マルチ') ||
    raw.includes('元肥')
  ) {
    return 'soil';
  }

  // ① 準備・段取り
  if (
    raw.includes('準備') ||
    raw.includes('段取') ||
    raw.includes('移動') ||
    raw.includes('運搬') ||
    raw.includes('メンテ') ||
    raw.includes('点検')
  ) {
    return 'prep';
  }

  // ③ 定植・種まき
  if (
    raw.includes('播種') ||
    raw.includes('種まき') ||
    raw.includes('たねまき') ||
    raw.includes('定植') ||
    raw.includes('苗植') ||
    raw.includes('植付') ||
    raw.includes('田植')
  ) {
    return 'planting';
  }

  // ⑤ 収穫・出荷
  if (
    raw.includes('収穫') ||
    raw.includes('出荷') ||
    raw.includes('袋詰') ||
    raw.includes('箱詰') ||
    raw.includes('選別') ||
    raw.includes('荷造') ||
    raw.includes('パック')
  ) {
    return 'harvest';
  }

  // ④ 管理（水やり・防除・追肥・芽かき・誘引・草刈り等）
  return 'care';
}

/**
 * 作業内容（work_type）から3大工程カテゴリを自動判定する
 */
export function classifyWorkProcess(workType: string | null | undefined): ProcessCategory {
  const raw = String(workType || '').trim();
  if (!raw) return 'care';

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
    raw.includes('マルチはがし') ||
    raw.includes('耕起') ||
    raw.includes('深耕') ||
    raw.includes('反転') ||
    raw.includes('土づくり')
  ) {
    return 'prep_cleanup';
  }

  if (
    raw.includes('収穫') ||
    raw.includes('播種') ||
    raw.includes('種まき') ||
    raw.includes('たねまき') ||
    raw.includes('定植') ||
    raw.includes('苗植') ||
    raw.includes('植付') ||
    raw.includes('田植') ||
    raw.includes('出荷') ||
    raw.includes('袋詰') ||
    raw.includes('箱詰') ||
    raw.includes('選別') ||
    raw.includes('荷造') ||
    raw.includes('パック')
  ) {
    return 'direct';
  }

  return 'care';
}

/**
 * 現場入力用の3分類（内部6大工程紐づけ）作業プリセット
 */
export const FIELD_WORK_PROCESS_GROUPS: Array<{
  category: ProcessCategory;
  title: string;
  subtitle: string;
  headerColor: string;
  activeBtnClass: string;
  items: Array<{ name: string; emoji: string; stage: SixStageKey }>;
}> = [
  {
    category: 'direct',
    title: '🟢 直接利益を生む作業（③定植・種まき ／ ⑤収穫・出荷）',
    subtitle: '売上に直結する最優先のコア作業',
    headerColor: 'text-emerald-300',
    activeBtnClass: 'bg-emerald-400 text-emerald-950 border-2 border-white shadow-md scale-[1.02]',
    items: [
      { name: '収穫', emoji: '🧺', stage: 'harvest' },
      { name: '出荷・袋詰め', emoji: '📦', stage: 'harvest' },
      { name: '播種', emoji: '🌱', stage: 'planting' },
      { name: '定植', emoji: '🌿', stage: 'planting' }
    ]
  },
  {
    category: 'care',
    title: '🟡 育成・維持管理作業（④管理）',
    subtitle: '作物を順調に育てるための管理工程',
    headerColor: 'text-amber-300',
    activeBtnClass: 'bg-amber-400 text-amber-950 border-2 border-white shadow-md scale-[1.02]',
    items: [
      { name: '水やり', emoji: '💧', stage: 'care' },
      { name: '芽かき・誘引', emoji: '✂️', stage: 'care' },
      { name: '肥料・農薬', emoji: '🧪', stage: 'care' },
      { name: '草刈り', emoji: '🌾', stage: 'care' }
    ]
  },
  {
    category: 'prep_cleanup',
    title: '🔴 準備・土づくり・片付け（①準備 ／ ②土づくり ／ ⑥片付け）',
    subtitle: '記録して段取り改善・事前工程化・短期バイト圧縮に活かす作業',
    headerColor: 'text-rose-300',
    activeBtnClass: 'bg-rose-400 text-rose-950 border-2 border-white shadow-md scale-[1.02]',
    items: [
      { name: '準備・段取り', emoji: '🛠️', stage: 'prep' },
      { name: '耕起・深耕・土づくり', emoji: '🚜', stage: 'soil' },
      { name: '畝立て・マルチ・水平調整', emoji: '📐', stage: 'soil' },
      { name: '片付け・残渣撤去', emoji: '🧹', stage: 'cleanup' }
    ]
  }
];

/**
 * 現場の「手こずり・畑の気づき補足」構造化データ
 */
export type BottleneckStatus = 'smooth' | 'struggled' | 'caution';

export interface WorkBottleneckData {
  status: BottleneckStatus;
  causeTag: string;          // 例: '🧱 土が硬い・土壌問題', '🧹 片付け・ツル絡み難航', '🌊 水平・水回り（クレーター等）'
  extraMinutes: number;      // 余計にかかったロス時間（分）
  detailNote: string;        // 具体的な状況補足
  nextActionIdea: string;    // 次回（来年）への改善提案
  driveUrl: string;          // GoogleドライブURL
}

export const BOTTLENECK_CAUSE_PRESETS = [
  {
    id: 'soil_hard',
    label: '🧱 土が硬い・石・土壌構造の問題',
    placeholder: '例：第2畑の奥半分、深さ15cmに硬い層があり穴あけに通常の2倍時間がかかった',
    suggestedNextAction: '定植前の空き時期に「深耕・反転」を1工程挟む',
    recommendedActionType: 'add_pre_step' as const
  },
  {
    id: 'cleanup_hard',
    label: '🧹 片付け・ツル絡み・残渣撤去の難航',
    placeholder: '例：モヤのツルとネットが絡み合い、社員2人で外すのに何日もかかってしまった',
    suggestedNextAction: '次回は臨時雇用（バイト）を投入して2日間で一気に片付け、ネットの張り方も変更する',
    recommendedActionType: 'temp_worker_compress' as const
  },
  {
    id: 'water_level',
    label: '🌊 水田の水平・水回り（クレーター防止等）',
    placeholder: '例：中央が低くクレーター状に水が溜まりやすいため、代かき前の均平調整が必須',
    suggestedNextAction: '代かき前の「水平調整（クレーター防止）」を絶対必須工程としてスケジュール固定する',
    recommendedActionType: 'lock_critical_step' as const
  },
  {
    id: 'prep_wait',
    label: '🚜 機械・資材・苗の段取り待ち',
    placeholder: '例：資材やトラクターのアタッチメント準備が当日朝になり開始が1時間遅れた',
    suggestedNextAction: '前日夕方に資材配置・機械セットを完了させる事前段取りを入れる',
    recommendedActionType: 'add_pre_step' as const
  },
  {
    id: 'weed_pest',
    label: '🌿 雑草・病害虫の想定外発生',
    placeholder: '例：畝間の草が伸びすぎて手取り除草に丸1日かかった',
    suggestedNextAction: '雑草が小さいうちに早期除草または防草シート・太陽熱処理を入れる',
    recommendedActionType: 'add_pre_step' as const
  }
];

/**
 * work_logs.memo に手こずり補足を人間にも読みやすく、かつ機械解析可能に埋め込む
 */
export function serializeWorkMemoWithBottleneck(
  plainMemo: string,
  bottleneck?: Partial<WorkBottleneckData> | null
): string {
  const cleanText = String(plainMemo || '')
    .replace(/【(💦手こずり報告|⚠️重要注意点)[^】]*】\n?/g, '')
    .trim();

  if (!bottleneck || !bottleneck.status || bottleneck.status === 'smooth') {
    return cleanText;
  }

  const headTag = bottleneck.status === 'struggled' ? '💦手こずり報告' : '⚠️重要注意点';
  const parts: string[] = [headTag];
  if (bottleneck.causeTag) parts.push(`原因:${bottleneck.causeTag}`);
  if (bottleneck.extraMinutes && bottleneck.extraMinutes > 0) {
    parts.push(`ロス:+${bottleneck.extraMinutes}分`);
  }
  if (bottleneck.nextActionIdea) {
    parts.push(`次期対策:${bottleneck.nextActionIdea.replace(/[|】]/g, ' ')}`);
  }
  if (bottleneck.driveUrl) {
    parts.push(`📁:${bottleneck.driveUrl.trim()}`);
  }

  const header = `【${parts.join('|')}】`;
  const detail = (bottleneck.detailNote || '').trim();
  const combinedBody = [detail, cleanText].filter(Boolean).join(' / ');
  return combinedBody ? `${header}\n${combinedBody}` : header;
}

/**
 * work_logs.memo から手こずり補足情報を抽出する（既存メモのキーワード自動検知フォールバック付き）
 */
export function parseWorkMemoBottleneck(rawMemo: string | null | undefined): {
  hasBottleneck: boolean;
  status: BottleneckStatus;
  causeTag: string;
  extraMinutes: number;
  nextActionIdea: string;
  driveUrl: string;
  cleanBody: string;
} {
  const text = String(rawMemo || '').trim();
  if (!text) {
    return {
      hasBottleneck: false,
      status: 'smooth',
      causeTag: '',
      extraMinutes: 0,
      nextActionIdea: '',
      driveUrl: '',
      cleanBody: ''
    };
  }

  const match = text.match(/【(💦手こずり報告|⚠️重要注意点)([^】]*)】\n?([\s\S]*)/);
  if (match) {
    const status: BottleneckStatus = match[1] === '💦手こずり報告' ? 'struggled' : 'caution';
    const metaStr = match[2] || '';
    const cleanBody = (match[3] || '').trim();

    let causeTag = '';
    let extraMinutes = 0;
    let nextActionIdea = '';
    let driveUrl = '';

    metaStr.split('|').forEach(seg => {
      const s = seg.trim();
      if (s.startsWith('原因:')) causeTag = s.slice(3).trim();
      else if (s.startsWith('ロス:')) {
        const num = parseInt(s.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) extraMinutes = num;
      } else if (s.startsWith('次期対策:')) {
        nextActionIdea = s.slice(5).trim();
      } else if (s.startsWith('📁:')) {
        driveUrl = s.slice(2).trim();
      }
    });

    return {
      hasBottleneck: true,
      status,
      causeTag: causeTag || '現場手こずり・注意点',
      extraMinutes,
      nextActionIdea,
      driveUrl,
      cleanBody
    };
  }

  // 構造化タグがない過去メモでも、重要キーワードがあれば自動検出する
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (
    text.includes('手こず') ||
    text.includes('硬い') ||
    text.includes('固い') ||
    text.includes('クレーター') ||
    text.includes('水平') ||
    text.includes('時間がかか') ||
    text.includes('難航')
  ) {
    let causeTag = '現場の気づき・手こずり';
    let nextActionIdea = '';
    if (text.includes('硬い') || text.includes('固い') || text.includes('深耕')) {
      causeTag = '🧱 土が硬い・土壌構造の問題';
      nextActionIdea = '事前に深耕・反転を1工程挟む';
    } else if (text.includes('クレーター') || text.includes('水平') || text.includes('均平')) {
      causeTag = '🌊 水田の水平・水回り（クレーター防止）';
      nextActionIdea = '代かき前の水平均平調整を必須工程としてロック';
    } else if (text.includes('片付') || text.includes('絡')) {
      causeTag = '🧹 片付け・撤去手順の難航';
      nextActionIdea = '臨時雇用投入で短期圧縮＋仕立て方法の見直し';
    }
    return {
      hasBottleneck: true,
      status: 'struggled',
      causeTag,
      extraMinutes: 0,
      nextActionIdea,
      driveUrl: urlMatch ? urlMatch[0] : '',
      cleanBody: text
    };
  }

  return {
    hasBottleneck: false,
    status: 'smooth',
    causeTag: '',
    extraMinutes: 0,
    nextActionIdea: '',
    driveUrl: urlMatch ? urlMatch[0] : '',
    cleanBody: text
  };
}

/**
 * 次期作付け・作業指示に自動還流させる「工程見直しレシピ（PDCA処方箋）」
 */
export type RecipeActionType = 'add_pre_step' | 'temp_worker_compress' | 'lock_critical_step';

export interface ProcessImprovementRecipe {
  id: string;
  fieldId: string;        // 特定畑ID または 'all'
  fieldName: string;
  cropId: string;         // 特定品目ID または 'all'
  cropName: string;
  stageKey: SixStageKey;
  actionType: RecipeActionType;
  title: string;          // 例: '定植2週間前に「深耕・反転」を1工程追加'
  reasonSummary: string;  // 例: '定植時に深さ15cmの硬い層で+15h超過したため'
  targetHours: number;    // 目安時間
  tempWorkersCount?: number; // 臨時バイト人数（例: 5人）
  targetDays?: number;       // 目標完了日数（例: 2日）
  driveUrl?: string;      // Googleドライブ参考手順書・写真URL
  createdAt: string;
}
