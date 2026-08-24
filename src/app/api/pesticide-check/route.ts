import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =========================================================================
// 【究極の表記揺れ吸収・正規化エンジン】
// 大文字・小文字、全角・半角英数、ひらがな・全角カタカナ・半角カナ、
// 捨て仮名、長音符、空白、記号の全方位を100%均一化
// =========================================================================
export function fuzzyNormalize(str: string): string {
  if (!str) return '';
  let s = String(str)
    .normalize('NFKC') // 半角カナ -> 全角カナ、全角英数 -> 半角英数、全角記号 -> 半角記号 を一括変換！
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60)) // ひらがな -> カタカナ
    // 捨て仮名（小文字カタカナ）を大文字カタカナに統一
    .replace(/ァ/g, 'ア').replace(/ィ/g, 'イ').replace(/ゥ/g, 'ウ').replace(/ェ/g, 'エ').replace(/ォ/g, 'オ')
    .replace(/ッ/g, 'ツ').replace(/ャ/g, 'ヤ').replace(/ュ/g, 'ユ').replace(/ョ/g, 'ヨ')
    .replace(/ヮ/g, 'ワ').replace(/ヵ/g, 'カ').replace(/ヶ/g, 'ケ')
    // 「ヤ行」「ア行」の一般的な表記揺れ（例: ダイヤ -> ダイア）
    .replace(/ダイヤ/g, 'ダイア')
    // 長音符・ハイフンを「ー」に統一
    .replace(/[-‐―−ー～~]/g, 'ー')
    // 空白・スペース・記号を除去
    .replace(/[\s　・･()（）\[\]【】]/g, '');

  return s;
}

export function isFuzzyMatch(targetStr: string, queryStr: string): boolean {
  if (!queryStr) return true;
  return fuzzyNormalize(targetStr).includes(fuzzyNormalize(queryStr));
}

// 完璧な全角カタカナ -> 半角カタカナ変換マップ
const FULL_TO_HALF_KANA_MAP: { [key: string]: string } = {
  'ア': 'ｱ', 'イ': 'ｲ', 'ウ': 'ｳ', 'エ': 'ｴ', 'オ': 'ｵ',
  'カ': 'ｶ', 'キ': 'ｷ', 'ク': 'ｸ', 'ケ': 'ｹ', 'コ': 'ｺ',
  'サ': 'ｻ', 'シ': 'ｼ', 'ス': 'ｽ', 'セ': 'ｾ', 'ソ': 'ｿ',
  'タ': 'ﾀ', 'チ': 'ﾁ', 'ツ': 'ﾂ', 'テ': 'ﾃ', 'ト': 'ﾄ',
  'ナ': 'ﾅ', 'ニ': 'ﾆ', 'ヌ': 'ﾇ', 'ネ': 'ﾈ', 'ノ': 'ﾉ',
  'ハ': 'ﾊ', 'ヒ': 'ﾋ', 'フ': 'ﾌ', 'ヘ': 'ﾍ', 'ホ': 'ﾎ',
  'マ': 'ﾏ', 'ミ': 'ﾐ', 'ム': 'ﾑ', 'メ': 'ﾒ', 'モ': 'ﾓ',
  'ヤ': 'ﾔ', 'ユ': 'ﾕ', 'ヨ': 'ﾖ',
  'ラ': 'ﾗ', 'リ': 'ﾘ', 'ル': 'ﾙ', 'レ': 'ﾚ', 'ロ': 'ﾛ',
  'ワ': 'ﾜ', 'ヲ': 'ｦ', 'ン': 'ﾝ',
  'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', 'グ': 'ｸﾞ', 'ゲ': 'ｹﾞ', 'ゴ': 'ｺﾞ',
  'ザ': 'ｻﾞ', 'ジ': 'ｼﾞ', 'ズ': 'ｽﾞ', 'ゼ': 'ｾﾞ', 'ゾ': 'ｿﾞ',
  'ダ': 'ﾀﾞ', 'ヂ': 'ﾁﾞ', 'ヅ': 'ﾂﾞ', 'デ': 'ﾃﾞ', 'ド': 'ﾄﾞ',
  'バ': 'ﾊﾞ', 'ビ': 'ﾋﾞ', 'ブ': 'ﾌﾞ', 'ベ': 'ﾍﾞ', 'ボ': 'ﾎﾞ',
  'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', 'プ': 'ﾌﾟ', 'ペ': 'ﾍﾟ', 'ポ': 'ﾎﾟ',
  'ァ': 'ｧ', 'ィ': 'ｨ', 'ゥ': 'ｩ', 'ェ': 'ｪ', 'ォ': 'ｫ',
  'ッ': 'ｯ', 'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ',
  'ー': 'ｰ', 'ヴ': 'ｳﾞ'
};

function toHalfWidthKana(str: string): string {
  if (!str) return '';
  let s = '';
  for (const c of str) {
    s += FULL_TO_HALF_KANA_MAP[c] || c;
  }
  return s;
}

function toKatakana(str: string): string {
  if (!str) return '';
  return str.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

function toHiragana(str: string): string {
  if (!str) return '';
  return str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}

function toFullWidthAlphanumeric(str: string): string {
  if (!str) return '';
  return str.replace(/[A-Za-z0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
}

// データベースクエリ用の網羅的キーワード展開
function generateSearchVariants(raw: string): string[] {
  if (!raw) return [];
  const nfkc = raw.normalize('NFKC').trim();
  const rawClean = raw.trim();

  const kata = toKatakana(nfkc);
  const hira = toHiragana(nfkc);
  const halfKana = toHalfWidthKana(kata);

  const lower = nfkc.toLowerCase();
  const upper = nfkc.toUpperCase();
  const fullAlpha = toFullWidthAlphanumeric(nfkc);
  const fullAlphaLower = toFullWidthAlphanumeric(lower);
  const fullAlphaUpper = toFullWidthAlphanumeric(upper);

  const halfKataLower = toHalfWidthKana(toKatakana(lower));
  const halfKataUpper = toHalfWidthKana(toKatakana(upper));

  const variants = new Set<string>([
    rawClean, nfkc,
    kata, hira, halfKana,
    lower, upper,
    fullAlpha, fullAlphaLower, fullAlphaUpper,
    halfKataLower, halfKataUpper
  ]);

  return Array.from(variants).filter(s => s && s.length > 0);
}

// 冠名（メーカープレフィックス）抽出＆正規化関数
const MANUFACTURER_PREFIXES = [
  '住化', '住友化学', '住友',
  '日農', '日本農薬',
  'ホクコー', '北興化学', '北興',
  'クミアイ化学', 'クミアイ',
  'サンケイ化学', 'サンケイ',
  '三井化学', '三井',
  '協友アグリ', '協友',
  '科研製薬', '科研',
  '丸和バイオケミカル', '丸和',
  '日産化学', '日産',
  '石原バイオサイエンス', '石原産業', '石原',
  '日本曹達', '日曹',
  'OATアグリオ', 'OAT', 'ＯＡＴ',
  'アグロカネショウ', 'カネショウ',
  'シンジェンタジャパン', 'シンジェンタ',
  'バイエルクロップサイエンス', 'バイエル',
  'BASFジャパン', 'BASF', 'ＢＡＳＦ',
  'コルテバ', '丸紅', 'イハラ'
];

function extractCanonicalPesticideName(fullName: string): { canonicalName: string; prefix: string } {
  const clean = fullName.trim();
  for (const prefix of MANUFACTURER_PREFIXES) {
    if (clean.startsWith(prefix) && clean.length > prefix.length) {
      return {
        canonicalName: clean.slice(prefix.length).trim(),
        prefix: prefix
      };
    }
  }
  return {
    canonicalName: clean,
    prefix: ''
  };
}

// 作物の正規化マップ（厳格な直接同義語のみ）
const CROP_SYNONYMS: { [key: string]: string[] } = {
  'たまねぎ': ['たまねぎ', 'タマネギ', '玉ねぎ', '玉葱', 'たまねぎ(本畑)', 'ﾀﾏﾈｷﾞ'],
  'トマト': ['トマト', 'ミニトマト', 'ﾄﾏﾄ', 'ﾐﾆﾄﾏﾄ', 'とまと'],
  'とうがらし': ['とうがらし', 'トウガラシ', 'ピーマン', 'とうがらし類', 'トウガラシ類', 'ﾄｳｶﾞﾗｼ', 'ﾋﾟｰﾏﾝ', '唐辛子'],
  'きゅうり': ['きゅうり', 'キュウリ', '胡瓜', 'ｷｭｳﾘ'],
  'キャベツ': ['キャベツ', 'かんらん', 'ｷｬﾍﾞﾂ', '甘藍'],
  'レタス': ['レタス', '非結球レタス', 'ﾚﾀｽ'],
  'ねぎ': ['ねぎ', 'ネギ', '葱', '葉ねぎ', '根深ねぎ', 'ﾈｷﾞ', '葉ﾈｷﾞ'],
  'なす': ['なす', 'ナス', '茄子', 'ﾅｽ'],
  'ほうれんそう': ['ほうれんそう', 'ホウレンソウ', 'ほうれん草', 'ﾎｳﾚﾝｿｳ'],
  'だいこん': ['だいこん', 'ダイコン', '大根', 'ﾀﾞｲｺﾝ'],
  'にんじん': ['にんじん', 'ニンジン', '人参', 'ﾆﾝｼﾞﾝ'],
  'いちご': ['いちご', 'イチゴ', '苺', 'ｲﾁｺﾞ'],
  'すいか': ['すいか', 'スイカ', '西瓜', 'ｽｲｶ'],
  'メロン': ['メロン', 'ﾒﾛﾝ']
};

function getNormalizedCrops(inputCrop: string): string[] {
  const norm = inputCrop.trim().toLowerCase();
  for (const [key, list] of Object.entries(CROP_SYNONYMS)) {
    if (norm === key || list.some(s => s.toLowerCase() === norm || norm.includes(s.toLowerCase()))) {
      const halfList = list.map(s => toHalfWidthKana(toKatakana(s)));
      return Array.from(new Set([...list, ...halfList]));
    }
  }
  return generateSearchVariants(inputCrop);
}

export async function POST(request: Request) {
  try {
    const { cropName, pesticideName, targetPest, stageFilter } = await request.json();

    const cleanCropName = cropName?.trim() || '';
    const cleanTargetPest = targetPest?.trim() || '';
    const cleanPesticideName = pesticideName?.trim() || '';

    if (!cleanCropName && !cleanPesticideName && !cleanTargetPest) {
      return NextResponse.json({ error: '作物名、農薬名、または病害虫名のいずれかを入力してください。' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let allUsages: any[] = [];

    // パターンA: 作物名が指定されている場合
    if (cleanCropName) {
      const searchCrops = getNormalizedCrops(cleanCropName);
      for (const c of searchCrops) {
        if (!c) continue;
        const cVariants = generateSearchVariants(c);
        const orCrops = cVariants.map(v => `crop_name.eq.${v},crop_name.ilike.%${v}%`).join(',');

        let q = supabase
          .from('m_pesticide_usages')
          .select('*')
          .or(orCrops);

        if (cleanTargetPest) {
          const pestVariants = generateSearchVariants(cleanTargetPest);
          const orPests = pestVariants.map(p => `target_pest.ilike.%${p}%`).join(',');
          q = q.or(orPests);
        }

        const { data } = await q.limit(1000);
        if (data) {
          // 「ねぎ」で「たまねぎ」が混ざったり、逆に「たまねぎ」で「ねぎ」が混ざるのを厳密にフィルタ
          const filtered = data.filter((row: any) => {
            const rowCrop = (row.crop_name || '').toLowerCase();
            if (cleanCropName.includes('たまねぎ') || cleanCropName.includes('玉ねぎ') || cleanCropName.includes('タマネギ')) {
              return rowCrop.includes('たまねぎ') || rowCrop.includes('タマネギ') || rowCrop.includes('ﾀﾏﾈｷﾞ');
            }
            if (cleanCropName === 'ねぎ' || cleanCropName === 'ネギ') {
              return !rowCrop.includes('たまねぎ') && !rowCrop.includes('タマネギ');
            }
            return true;
          });
          allUsages = allUsages.concat(filtered);
        }
      }
    } 
    // パターンB: 作物名がなく、農薬名が指定されている場合
    else if (cleanPesticideName) {
      const pVariants = generateSearchVariants(cleanPesticideName);
      const orNames = pVariants.map(p => `pesticide_name.ilike.%${p}%`).join(',');

      const { data: matchedPests } = await supabase
        .from('m_pesticides')
        .select('registration_no, pesticide_name')
        .or(orNames)
        .limit(200);

      if (matchedPests && matchedPests.length > 0) {
        const regNos = matchedPests.map(p => p.registration_no);
        const { data: usageData } = await supabase
          .from('m_pesticide_usages')
          .select('*')
          .in('registration_no', regNos)
          .limit(2000);

        if (usageData) {
          allUsages = usageData;
        }
      }
    }
    // パターンC: 病害虫名のみが指定されている場合
    else if (cleanTargetPest) {
      const pestVariants = generateSearchVariants(cleanTargetPest);
      const orPests = pestVariants.map(p => `target_pest.ilike.%${p}%`).join(',');

      const { data: pestUsages } = await supabase
        .from('m_pesticide_usages')
        .select('*')
        .or(orPests)
        .limit(1500);

      if (pestUsages) {
        allUsages = pestUsages;
      }
    }

    if (allUsages.length === 0) {
      return NextResponse.json({
        judgment: '該当なし',
        message: `データベース内には、指定の条件に一致する適用可能な農薬情報が見つかりませんでした。`,
        pesticides: [],
        availableStages: [
          { key: 'all', label: 'すべて', count: 0 },
          { key: 'edible', label: '🧅 食用（本圃）', count: 0 },
          { key: 'seed', label: '🌱 採種用（種採り）', count: 0 },
          { key: 'nursery', label: '🌿 育苗期', count: 0 }
        ]
      });
    }

    // 2. 登録番号の一覧を抽出して m_pesticides から基本情報を一括取得
    const regNos = Array.from(new Set(allUsages.map((u: any) => u.registration_no)));
    const pestMap = new Map();

    const chunkSize = 500;
    for (let i = 0; i < regNos.length; i += chunkSize) {
      const chunk = regNos.slice(i, i + chunkSize);
      const { data: pestData } = await supabase
        .from('m_pesticides')
        .select('registration_no, pesticide_name, pesticide_type, applicant_name, purpose')
        .in('registration_no', chunk);

      if (pestData) {
        pestData.forEach(p => pestMap.set(p.registration_no, p));
      }
    }

    // 3. 【最重要】まず登録番号（メーカー商品）ごとに適用データを整理
    const productVariantMap = new Map<string, any>();

    allUsages.forEach((u: any) => {
      const regNo = u.registration_no;
      const pInfo = pestMap.get(regNo) || {};
      const fullName = pInfo.pesticide_name || '名称不明';

      // 多次元ステージ判定
      const combinedText = `${u.crop_name} ${u.usage_time} ${u.usage_method} ${u.target_pest} ${u.usage_purpose} ${u.active_ingredient_count_1 || ''} ${u.active_ingredient_count_2 || ''}`;
      const isSeed = combinedText.includes('採種') || combinedText.includes('種用') || combinedText.includes('母球') || combinedText.includes('種子');
      const isNursery = combinedText.includes('育苗') || combinedText.includes('苗床') || combinedText.includes('床土') || combinedText.includes('セル成型') || combinedText.includes('トレイ') || combinedText.includes('苗立枯');
      const isEdible = !isSeed || combinedText.includes('本圃') || combinedText.includes('本畑') || combinedText.includes('収穫');

      // 有効成分情報のパース
      const rawIngredients = [
        u.active_ingredient_count_1,
        u.active_ingredient_count_2,
        u.active_ingredient_count_3,
        u.active_ingredient_count_4,
        u.active_ingredient_count_5
      ].filter(Boolean);

      const activeIngredients = rawIngredients.map((raw: string) => {
        const clean = String(raw).trim();
        if (!clean || clean === '-') return null;
        const countMatch = clean.match(/(\d+)回以内/);
        const maxCount = countMatch ? parseInt(countMatch[1], 10) : null;
        let name = '';
        if (clean.includes('：') || clean.includes(':')) {
          name = clean.split(/[：:]/)[0].trim().replace(/を含む農薬の総使用回数/, '');
        } else if (clean.includes('を含む農薬の総使用回数')) {
          name = clean.split('を含む農薬の総使用回数')[0].trim();
        } else {
          name = pInfo.pesticide_type && pInfo.pesticide_type !== '-' ? pInfo.pesticide_type : fullName || '有効成分';
        }
        return { raw: clean, name: name || '有効成分', maxCount, limitDetails: clean };
      }).filter(Boolean);

      if (!productVariantMap.has(regNo)) {
        const { canonicalName, prefix } = extractCanonicalPesticideName(fullName);
        productVariantMap.set(regNo, {
          registration_no: regNo,
          full_name: fullName,
          canonical_name: canonicalName,
          prefix: prefix,
          applicant: pInfo.applicant_name || '-',
          type: pInfo.pesticide_type || '-',
          purpose: pInfo.purpose || '-',
          crop_name: u.crop_name,
          scope_label: `🎯 ${u.crop_name} 正式登録`,
          is_edible: false,
          is_seed: false,
          is_nursery: false,
          target_pests: new Set<string>(),
          usages_list: [],
          active_ingredients: activeIngredients,
          usage_amount: u.usage_amount || '-',
          usage_time: u.usage_time || '-',
          usage_method: u.usage_method || '-',
          usage_count: u.usage_count || '-',
          spray_amount: u.spray_amount || '-',
          application_place: u.application_place || '-'
        });
      }

      const variant = productVariantMap.get(regNo)!;
      if (isEdible) variant.is_edible = true;
      if (isSeed) variant.is_seed = true;
      if (isNursery) variant.is_nursery = true;

      if (u.target_pest && u.target_pest !== '-') {
        variant.target_pests.add(u.target_pest);
      }
      variant.usages_list.push({
        target_pest: u.target_pest || '-',
        usage_amount: u.usage_amount || '-',
        usage_time: u.usage_time || '-',
        usage_method: u.usage_method || '-',
        usage_count: u.usage_count || '-'
      });
    });

    // 4. 【代表商品名（冠名除去名）でさらに親グループ化！】
    // 例: 「住化スミレックス水和剤」「日農スミレックス水和剤」 -> 代表「スミレックス水和剤」
    const canonicalGroupsMap = new Map<string, any>();

    productVariantMap.forEach((v) => {
      // 【最重要】農薬名検索フィルター（究極の表記揺れ吸収判定）
      if (cleanPesticideName) {
        const matchesFullName = isFuzzyMatch(v.full_name, cleanPesticideName);
        const matchesCanonical = isFuzzyMatch(v.canonical_name, cleanPesticideName);
        if (!matchesFullName && !matchesCanonical) return;
      }

      // 病害虫名フィルター（病害虫が指定されている場合）
      if (cleanTargetPest) {
        const hasMatchingPest = Array.from(v.target_pests as Set<string>).some(p => isFuzzyMatch(p, cleanTargetPest));
        if (!hasMatchingPest) return;
      }

      const cName = v.canonical_name;
      if (!canonicalGroupsMap.has(cName)) {
        canonicalGroupsMap.set(cName, {
          name: cName, // 代表商品名（あいうえお順の基準）
          type: v.type, // 種類名 (例: プロシミドン水和剤)
          purpose: v.purpose, // 用途 (例: 殺菌剤)
          active_ingredients: v.active_ingredients,
          is_edible: false,
          is_seed: false,
          is_nursery: false,
          stage_badge: '🧅 食用（本圃）認可',
          variants: [],
          all_target_pests: new Set<string>()
        });
      }

      const parent = canonicalGroupsMap.get(cName)!;
      if (v.is_edible) parent.is_edible = true;
      if (v.is_seed) parent.is_seed = true;
      if (v.is_nursery) parent.is_nursery = true;

      // 病害虫の統合
      v.target_pests.forEach((pest: string) => parent.all_target_pests.add(pest));

      // 代表バッジの設定
      if (parent.is_seed) parent.stage_badge = '🌱 採種用（種採り）認可';
      else if (parent.is_nursery && !parent.is_edible) parent.stage_badge = '🌿 育苗期 専用認可';
      else parent.stage_badge = '🧅 食用（本圃）認可';

      parent.variants.push({
        registration_no: v.registration_no,
        full_name: v.full_name,
        prefix: v.prefix,
        applicant: v.applicant,
        type: v.type,
        purpose: v.purpose,
        scope_label: v.scope_label,
        usage_amount: v.usage_amount,
        usage_time: v.usage_time,
        usage_method: v.usage_method,
        usage_count: v.usage_count,
        spray_amount: v.spray_amount,
        target_pests_array: Array.from(v.target_pests),
        target_pest: Array.from(v.target_pests).join(', ') || '全般',
        usages_list: v.usages_list,
        active_ingredients: v.active_ingredients
      });
    });

    // 5. 【あいうえお順ソート】代表商品名（冠名除去名）で五十音順ソート！
    const pesticides = Array.from(canonicalGroupsMap.values()).map(g => {
      const primary = g.variants[0] || {};
      return {
        ...g,
        registration_no: primary.registration_no || '',
        applicant: g.variants.map((v: any) => v.prefix || v.applicant).filter(Boolean).join(', ') || primary.applicant,
        target_pest: Array.from(g.all_target_pests).join(', ') || '全般',
        target_pests_array: Array.from(g.all_target_pests),
        usage_amount: primary.usage_amount || '-',
        usage_time: primary.usage_time || '-',
        usage_method: primary.usage_method || '-',
        usage_count: primary.usage_count || '-',
        spray_amount: primary.spray_amount || '-'
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));

    // ステージ集計
    const edibleCount = pesticides.filter(p => p.is_edible).length;
    const seedCount = pesticides.filter(p => p.is_seed).length;
    const nurseryCount = pesticides.filter(p => p.is_nursery).length;

    const availableStages = [
      { key: 'all', label: 'すべて', count: pesticides.length },
      { key: 'edible', label: '🧅 食用（本圃）', count: edibleCount },
      { key: 'seed', label: '🌱 採種用（種採り）', count: seedCount },
      { key: 'nursery', label: '🌿 育苗期', count: nurseryCount }
    ];

    let filteredPesticides = pesticides;
    if (stageFilter === 'edible') {
      filteredPesticides = pesticides.filter(p => p.is_edible);
    } else if (stageFilter === 'seed') {
      filteredPesticides = pesticides.filter(p => p.is_seed);
    } else if (stageFilter === 'nursery') {
      filteredPesticides = pesticides.filter(p => p.is_nursery);
    }

    return NextResponse.json({
      judgment: 'DB検索完了',
      status: filteredPesticides.length > 0 ? 'success' : 'warning',
      directCount: filteredPesticides.length,
      groupCount: 0,
      availableStages,
      activeStage: stageFilter || 'all',
      message: `正式登録されている農薬一覧です。（計${filteredPesticides.length}系統）`,
      pesticides: filteredPesticides
    });

  } catch (error: any) {
    console.error('Pesticide Check Error:', error);
    return NextResponse.json({ error: `サーバーエラー: ${error.message}` }, { status: 500 });
  }
}
