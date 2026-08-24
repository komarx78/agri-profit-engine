import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ひらがな・カタカナ変換関数（揺らぎ吸収用）
function toKatakana(str: string) {
  return str.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}
function toHiragana(str: string) {
  return str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}
function toHalfWidthKana(str: string) {
  const kanaMap: { [key: string]: string } = {
    'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', 'グ': 'ｸﾞ', 'ゲ': 'ｹﾞ', 'ゴ': 'ｺﾞ',
    'ザ': 'ｻﾞ', 'ジ': 'ｼﾞ', 'ズ': 'ｽﾞ', 'ゼ': 'ｾﾞ', 'ゾ': 'ｿﾞ',
    'ダ': 'ﾀﾞ', 'ヂ': 'ﾁﾞ', 'ヅ': 'ﾂﾞ', 'デ': 'ﾃﾞ', 'ド': 'ﾄﾞ',
    'バ': 'ﾊﾞ', 'ビ': 'ﾋﾞ', 'ブ': 'ﾌﾞ', 'ベ': 'ﾍﾞ', 'ボ': 'ﾎﾞ',
    'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', 'プ': 'ﾌﾟ', 'ペ': 'ﾍﾟ', 'ポ': 'ﾎﾟ',
    'ヴ': 'ｳﾞ', 'ヷ': 'ﾜﾞ', 'ヺ': 'ｦﾞ',
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
    'ァ': 'ｧ', 'ィ': 'ｨ', 'ゥ': 'ｩ', 'ェ': 'ｪ', 'ォ': 'ｫ',
    'ッ': 'ｯ', 'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ',
    'ー': 'ｰ', '、': '､', '。': '｡', '・': '･'
  };
  let reg = new RegExp('(' + Object.keys(kanaMap).join('|') + ')', 'g');
  return str.replace(reg, match => kanaMap[match]);
}

// 農作物の分類グループ（包括グループ辞書）
const CROP_HIERARCHY: { [key: string]: { direct: string[], subGroups: string[], broadGroups: string[] } } = {
  // 果菜類
  'トマト': { direct: ['トマト', 'ミニトマト'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'ミニトマト': { direct: ['ミニトマト', 'トマト'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'なす': { direct: ['なす', '茄子'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  '茄子': { direct: ['なす', '茄子'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'きゅうり': { direct: ['きゅうり', '胡瓜'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  '胡瓜': { direct: ['きゅうり', '胡瓜'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'ピーマン': { direct: ['ピーマン', 'パプリカ', 'とうがらし類'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'パプリカ': { direct: ['パプリカ', 'ピーマン', 'とうがらし類'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'いちご': { direct: ['いちご', '苺'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  '苺': { direct: ['いちご', '苺'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'すいか': { direct: ['すいか', 'スイカ', '西瓜'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'スイカ': { direct: ['すいか', 'スイカ', '西瓜'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'メロン': { direct: ['メロン'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'かぼちゃ': { direct: ['かぼちゃ', 'カボチャ', '南瓜'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'ズッキーニ': { direct: ['ズッキーニ'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },
  'オクラ': { direct: ['オクラ'], subGroups: ['果菜類'], broadGroups: ['野菜類'] },

  // 葉菜類
  'キャベツ': { direct: ['キャベツ'], subGroups: ['結球葉菜類', '葉菜類'], broadGroups: ['野菜類'] },
  'はくさい': { direct: ['はくさい', '白菜'], subGroups: ['結球葉菜類', '葉菜類'], broadGroups: ['野菜類'] },
  '白菜': { direct: ['はくさい', '白菜'], subGroups: ['結球葉菜類', '葉菜類'], broadGroups: ['野菜類'] },
  'レタス': { direct: ['レタス', '非結球レタス'], subGroups: ['結球葉菜類', '葉菜類'], broadGroups: ['野菜類'] },
  'ほうれんそう': { direct: ['ほうれんそう', 'ホウレンソウ', 'ほうれん草'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },
  'ほうれん草': { direct: ['ほうれんそう', 'ホウレンソウ', 'ほうれん草'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },
  'ねぎ': { direct: ['ねぎ', 'ネギ', '葱', '青ねぎ', '白ねぎ'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },
  'ネギ': { direct: ['ねぎ', 'ネギ', '葱', '青ねぎ', '白ねぎ'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },
  'こまつな': { direct: ['こまつな', 'コマツナ', '小松菜'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },
  '小松菜': { direct: ['こまつな', 'コマツナ', '小松菜'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },
  'ブロッコリー': { direct: ['ブロッコリー'], subGroups: ['花蕾類', '葉菜類'], broadGroups: ['野菜類'] },
  'カリフラワー': { direct: ['カリフラワー'], subGroups: ['花蕾類', '葉菜類'], broadGroups: ['野菜類'] },
  'チンゲンサイ': { direct: ['チンゲンサイ', '青梗菜'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },
  '春菊': { direct: ['しゅんぎく', '春菊'], subGroups: ['葉菜類'], broadGroups: ['野菜類'] },

  // 根菜類
  'だいこん': { direct: ['だいこん', 'ダイコン', '大根'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },
  '大根': { direct: ['だいこん', 'ダイコン', '大根'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },
  'にんじん': { direct: ['にんじん', 'ニンジン', '人参'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },
  '人参': { direct: ['にんじん', 'ニンジン', '人参'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },
  'たまねぎ': { direct: ['たまねぎ', 'タマネギ', '玉ねぎ', '玉葱'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },
  '玉ねぎ': { direct: ['たまねぎ', 'タマネギ', '玉ねぎ', '玉葱'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },
  'かぶ': { direct: ['かぶ', 'カブ', '蕪'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },
  'ごぼう': { direct: ['ごぼう', 'ゴボウ', '牛蒡'], subGroups: ['根菜類'], broadGroups: ['野菜類'] },

  // いも類
  'じゃがいも': { direct: ['ばれいしょ', 'バレイショ', 'ジャガイモ'], subGroups: ['いも類'], broadGroups: ['野菜類'] },
  '馬鈴薯': { direct: ['ばれいしょ', 'バレイショ'], subGroups: ['いも類'], broadGroups: ['野菜類'] },
  'さつまいも': { direct: ['かんしょ', 'カンショ', 'サツマイモ'], subGroups: ['いも類'], broadGroups: ['野菜類'] },
  'さといも': { direct: ['さといも', 'サトイモ', '里芋'], subGroups: ['いも類'], broadGroups: ['野菜類'] },

  // 豆類（未成熟）
  'えだまめ': { direct: ['えだまめ', 'エダマメ', '枝豆'], subGroups: ['未成熟豆類', '豆類（未成熟）'], broadGroups: ['野菜類'] },
  '枝豆': { direct: ['えだまめ', 'エダマメ', '枝豆'], subGroups: ['未成熟豆類', '豆類（未成熟）'], broadGroups: ['野菜類'] },
  'さやえんどう': { direct: ['さやえんどう', '実えんどう'], subGroups: ['未成熟豆類'], broadGroups: ['野菜類'] },
  'さやいんげん': { direct: ['さやいんげん', 'いんげん'], subGroups: ['未成熟豆類'], broadGroups: ['野菜類'] },

  // 穀物・果樹
  '水稲': { direct: ['水稲', '稲', '水稲（移植水稲）', '水稲（直播水稲）'], subGroups: ['食用作物'], broadGroups: [] },
  '米': { direct: ['水稲', '稲'], subGroups: ['食用作物'], broadGroups: [] },
  'みかん': { direct: ['温州みかん', 'みかん', 'かんきつ'], subGroups: ['かんきつ'], broadGroups: ['果樹類'] },
  'りんご': { direct: ['りんご', 'リンゴ'], subGroups: [], broadGroups: ['果樹類'] },
  'ぶどう': { direct: ['ぶどう', 'ブドウ'], subGroups: [], broadGroups: ['果樹類'] },
};

function getHierarchyKeywords(inputCrop: string) {
  const norm = inputCrop.trim().toLowerCase();
  
  // 完全一致または部分一致するエントリを検索
  for (const [key, value] of Object.entries(CROP_HIERARCHY)) {
    if (norm.includes(key.toLowerCase()) || key.toLowerCase().includes(norm)) {
      return value;
    }
  }

  // 見つからない場合でも、一般的な野菜と推定して「野菜類」を包括グループに追加
  return {
    direct: [inputCrop.trim()],
    subGroups: [],
    broadGroups: ['野菜類']
  };
}

export async function POST(request: Request) {
  try {
    const { cropName, pesticideName, targetPest, stageFilter } = await request.json();

    const cleanCropName = cropName?.trim() || '';
    const cleanTargetPest = targetPest?.trim() || '';
    const isSeedRequested = cleanCropName.includes('採種') || cleanCropName.includes('種用') || cleanCropName.includes('母球') || stageFilter === 'seed';
    const isNurseryRequested = cleanCropName.includes('育苗') || cleanCropName.includes('苗') || stageFilter === 'nursery';

    if (!cleanCropName) {
      return NextResponse.json(
        { error: '作物名は必須です。' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ベース作物名の抽出（例: 「玉ねぎ 採種用」 -> 「玉ねぎ」）
    const baseCrop = cleanCropName.replace(/[\s　]*(採種用|採種|種用|母球|育苗期|育苗|苗)[\s　]*/g, '').trim() || cleanCropName;

    // 作物の階層キーワードを展開
    const hierarchy = getHierarchyKeywords(baseCrop);
    const searchDirects = Array.from(new Set([baseCrop, ...hierarchy.direct, toKatakana(baseCrop), toHiragana(baseCrop)]));
    const searchSubGroups = Array.from(new Set([...hierarchy.subGroups, ...hierarchy.subGroups.map(toKatakana)]));
    const searchBroadGroups = Array.from(new Set([...hierarchy.broadGroups, ...hierarchy.broadGroups.map(toKatakana)]));

    // Supabaseの全件取得ヘルパー
    async function fetchKeywordsRows(keywords: string[]) {
      let combined: any[] = [];
      for (const kw of keywords) {
        if (!kw) continue;
        const kwHalf = toHalfWidthKana(toKatakana(kw));
        
        let q = supabase.from('m_pesticide_usages').select('*').or(`crop_name.like.%${kw}%,crop_name.like.%${kwHalf}%`);
        if (cleanTargetPest) {
          const pestKana = toKatakana(cleanTargetPest);
          const pestHalf = toHalfWidthKana(pestKana);
          q = q.or(`target_pest.like.%${cleanTargetPest}%,target_pest.like.%${pestKana}%,target_pest.like.%${pestHalf}%`);
        }
        const { data } = await q.limit(1000);
        if (data) {
          combined = combined.concat(data);
        }
      }
      return combined;
    }

    // 1. 直接適用（トマト等）
    const directUsages = await fetchKeywordsRows(searchDirects);
    // 2. 小グループ包括適用（果菜類等）
    const subGroupUsages = (!isSeedRequested && !isNurseryRequested) ? await fetchKeywordsRows(searchSubGroups) : [];
    // 3. 大グループ包括適用（野菜類等）
    const broadGroupUsages = (!isSeedRequested && !isNurseryRequested) ? await fetchKeywordsRows(searchBroadGroups) : [];

    // 重複を整理しながらスコープタグとステージ分類を付与
    const processedMap = new Map<string, any>();

    const classifyStage = (cName: string): { stage: 'seed' | 'nursery' | 'edible'; label: string } => {
      if (cName.includes('採種') || cName.includes('種用') || cName.includes('母球')) {
        return { stage: 'seed', label: '🌱 採種用 専用認可' };
      }
      if (cName.includes('育苗') || cName.includes('苗')) {
        return { stage: 'nursery', label: '🌿 育苗期 専用認可' };
      }
      return { stage: 'edible', label: '🧅 食用（本圃）認可' };
    };

    // 直接適用
    directUsages.forEach(u => {
      const stageInfo = classifyStage(u.crop_name);
      const key = `${u.registration_no}_${u.crop_name}_${u.target_pest}_${u.usage_amount}`;
      if (!processedMap.has(key)) {
        processedMap.set(key, { 
          ...u, 
          match_type: 'direct', 
          scope_label: `🎯 ${u.crop_name} 直接適用`,
          stage_category: stageInfo.stage,
          stage_badge: stageInfo.label
        });
      }
    });

    // 小グループ（果菜類）
    subGroupUsages.forEach(u => {
      const key = `${u.registration_no}_${u.crop_name}_${u.target_pest}_${u.usage_amount}`;
      if (!processedMap.has(key)) {
        processedMap.set(key, { 
          ...u, 
          match_type: 'subgroup', 
          scope_label: `🌱 ${u.crop_name} 包括適用`,
          stage_category: 'edible',
          stage_badge: '🥬 包括認可（小グループ）'
        });
      }
    });

    // 大グループ（野菜類）
    broadGroupUsages.forEach(u => {
      const key = `${u.registration_no}_${u.crop_name}_${u.target_pest}_${u.usage_amount}`;
      if (!processedMap.has(key)) {
        processedMap.set(key, { 
          ...u, 
          match_type: 'broad_group', 
          scope_label: `🥦 ${u.crop_name} 包括適用`,
          stage_category: 'edible',
          stage_badge: '🥦 野菜類 包括認可'
        });
      }
    });

    let usages = Array.from(processedMap.values());
    
    if (usages && usages.length > 0) {
       // 全件取得したため、pesticidesの取得もループで分割して行う（IN句の数上限エラーを防ぐため）
       const regNos = Array.from(new Set(usages.map((u: any) => u.registration_no))); // 重複排除
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

       let pesticides = usages.map((u: any) => {
          const pInfo = pestMap.get(u.registration_no) || {};
          
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
              const pType = pInfo.pesticide_type && pInfo.pesticide_type !== '-' ? pInfo.pesticide_type : '';
              name = pType || pInfo.pesticide_name || '有効成分';
            }

            return {
              raw: clean,
              name: name || '有効成分',
              maxCount,
              limitDetails: clean
            };
          }).filter(Boolean);

          return {
            name: pInfo.pesticide_name || '名称不明',
            type: pInfo.pesticide_type || '-',
            applicant: pInfo.applicant_name || '-',
            purpose: pInfo.purpose || '-',
            registration_no: u.registration_no,
            crop_name: u.crop_name,
            match_type: u.match_type || 'direct',
            scope_label: u.scope_label || `🎯 ${u.crop_name} 直接適用`,
            stage_category: u.stage_category || 'edible',
            stage_badge: u.stage_badge || '🧅 食用（本圃）認可',
            target_pest: u.target_pest || '-',
            usage_amount: u.usage_amount || '-',
            usage_time: u.usage_time || '-',
            usage_method: u.usage_method || '-',
            usage_count: u.usage_count || '-',
            application_place: u.application_place || '-',
            usage_purpose: u.usage_purpose || '-',
            spray_amount: u.spray_amount || '-',
            fumigation_time: u.fumigation_time || '-',
            fumigation_temp: u.fumigation_temp || '-',
            applicable_soil: u.applicable_soil || '-',
            applicable_region: u.applicable_region || '-',
            applicable_pesticide: u.applicable_pesticide || '-',
            mix_count: u.mix_count || '-',
            active_ingredients: activeIngredients
          };
       });

       const cleanPesticideName = pesticideName?.trim() || '';
       if (cleanPesticideName) {
         pesticides = pesticides.filter((p: any) => 
           p.name.includes(cleanPesticideName) ||
           toKatakana(p.name).includes(toKatakana(cleanPesticideName)) ||
           toHiragana(p.name).includes(toHiragana(cleanPesticideName))
         );
       }

       // 利用可能なステージの集計
       const edibleCount = pesticides.filter(p => p.stage_category === 'edible').length;
       const seedCount = pesticides.filter(p => p.stage_category === 'seed').length;
       const nurseryCount = pesticides.filter(p => p.stage_category === 'nursery').length;

       const availableStages = [
         { key: 'all', label: 'すべて', count: pesticides.length },
         ...(edibleCount > 0 ? [{ key: 'edible', label: '🧅 食用（本圃）', count: edibleCount }] : []),
         ...(seedCount > 0 ? [{ key: 'seed', label: '🌱 採種用（種採り）', count: seedCount }] : []),
         ...(nurseryCount > 0 ? [{ key: 'nursery', label: '🌿 育苗期', count: nurseryCount }] : [])
       ];

       // フィルタリング適用
       let filteredPesticides = pesticides;
       if (stageFilter && stageFilter !== 'all') {
         filteredPesticides = pesticides.filter(p => p.stage_category === stageFilter);
       } else if (isSeedRequested) {
         filteredPesticides = pesticides.filter(p => p.stage_category === 'seed');
       } else if (isNurseryRequested) {
         filteredPesticides = pesticides.filter(p => p.stage_category === 'nursery');
       }

       const directCount = filteredPesticides.filter(p => p.match_type === 'direct').length;
       const groupCount = filteredPesticides.filter(p => p.match_type !== 'direct').length;

       return NextResponse.json({
          judgment: 'DB検索完了',
          status: filteredPesticides.length > 0 ? 'success' : 'warning',
          directCount,
          groupCount,
          availableStages,
          activeStage: isSeedRequested ? 'seed' : isNurseryRequested ? 'nursery' : stageFilter || 'all',
          message: cleanPesticideName 
            ? `作物「${cleanCropName}」× 農薬「${cleanPesticideName}」の適用検索結果です。（直接登録: ${directCount}件 / 包括登録: ${groupCount}件）`
            : `作物「${cleanCropName}」に使える登録農薬一覧です。（直接登録: ${directCount}件 / 包括登録: ${groupCount}件 計${filteredPesticides.length}件）`,
          pesticides: filteredPesticides
       });
    } else {
       return NextResponse.json({
          judgment: '該当なし',
          message: `データベース内には、作物「${cleanCropName}」に対して適用可能な農薬情報が見つかりませんでした。（入力された名前や病害虫名がFAMICの登録名と異なる場合があります）`,
          pesticides: []
       });
    }

  } catch (error: any) {
    console.error('Pesticide Check Error:', error);
    return NextResponse.json(
      { error: `サーバーエラーが発生しました: ${error.message}` },
      { status: 500 }
    );
  }
}
