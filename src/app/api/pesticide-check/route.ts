import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// カナ変換ユーティリティ
function toKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

function toHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}

function toHalfWidthKana(str: string): string {
  const kanaMap: { [key: string]: string } = {
    'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', 'グ': 'ｸﾞ', 'ゲ': 'ｹﾞ', 'ゴ': 'ｺﾞ',
    'ザ': 'ｻﾞ', 'ジ': 'ｼﾞ', 'ズ': 'ｽﾞ', 'ゼ': 'ｾﾞ', 'ゾ': 'ｿﾞ',
    'ダ': 'ﾀﾞ', 'ヂ': 'ﾁﾞ', 'ヅ': 'ﾂﾞ', 'デ': 'ﾃﾞ', 'ド': 'ﾄﾞ',
    'バ': 'ﾊﾞ', 'ビ': 'ﾋﾞ', 'ブ': 'ﾌﾞ', 'ベ': 'ﾍﾞ', 'ボ': 'ﾎﾞ',
    'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', 'プ': 'ﾌﾟ', 'ペ': 'ﾍﾟ', 'ポ': 'ﾎﾟ',
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
    'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ', 'ッ': 'ｯ',
    'ー': 'ｰ'
  };
  return str.split('').map(c => kanaMap[c] || c).join('');
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
  const raw = inputCrop.trim();
  const kata = toKatakana(raw);
  const hira = toHiragana(raw);
  const half = toHalfWidthKana(kata);
  return Array.from(new Set([raw, kata, hira, half]));
}

export async function POST(request: Request) {
  try {
    const { cropName, pesticideName, targetPest, stageFilter } = await request.json();

    const cleanCropName = cropName?.trim() || '';
    const cleanTargetPest = targetPest?.trim() || '';
    const cleanPesticideName = pesticideName?.trim() || '';

    if (!cleanCropName) {
      return NextResponse.json({ error: '作物名は必須です。' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 作物名の正規化展開（半角カナ・全角カタカナ・ひらがな・漢字の完全網羅）
    const searchCrops = getNormalizedCrops(cleanCropName);

    // 1. m_pesticide_usages から厳密に対象作物のレコードを取得
    let allUsages: any[] = [];
    for (const c of searchCrops) {
      if (!c) continue;
      const cKata = toKatakana(c);
      const cHalf = toHalfWidthKana(cKata);

      let q = supabase
        .from('m_pesticide_usages')
        .select('*')
        .or(`crop_name.eq.${c},crop_name.eq.${cKata},crop_name.eq.${cHalf},crop_name.ilike.%${c}%`);

      if (cleanTargetPest) {
        const pestKana = toKatakana(cleanTargetPest);
        const pestHalf = toHalfWidthKana(pestKana);
        q = q.or(`target_pest.like.%${cleanTargetPest}%,target_pest.like.%${pestKana}%,target_pest.like.%${pestHalf}%`);
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

    if (allUsages.length === 0) {
      return NextResponse.json({
        judgment: '該当なし',
        message: `データベース内には、作物「${cleanCropName}」に対して適用可能な農薬情報が見つかりませんでした。`,
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

    // 3. 【最重要】農薬単位（登録番号単位）でグルーピング＆多次元ステージ判定
    const groupedMap = new Map<string, any>();

    allUsages.forEach((u: any) => {
      const regNo = u.registration_no;
      const pInfo = pestMap.get(regNo) || {};
      const pName = pInfo.pesticide_name || '名称不明';

      // 農薬名検索フィルター
      if (cleanPesticideName) {
        const matchesName = pName.includes(cleanPesticideName) ||
          toKatakana(pName).includes(toKatakana(cleanPesticideName)) ||
          toHiragana(pName).includes(toHiragana(cleanPesticideName));
        if (!matchesName) return;
      }

      // 多次元ステージ判定（作物名だけでなく、時期・方法・病害虫・回数内訳から全方位解析）
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
          name = pInfo.pesticide_type && pInfo.pesticide_type !== '-' ? pInfo.pesticide_type : pInfo.pesticide_name || '有効成分';
        }
        return { raw: clean, name: name || '有効成分', maxCount, limitDetails: clean };
      }).filter(Boolean);

      if (!groupedMap.has(regNo)) {
        groupedMap.set(regNo, {
          registration_no: regNo,
          name: pName,
          type: pInfo.pesticide_type || '-',
          applicant: pInfo.applicant_name || '-',
          purpose: pInfo.purpose || '-',
          crop_name: u.crop_name,
          match_type: 'direct',
          scope_label: `🎯 ${u.crop_name} 正式登録`,
          is_edible: false,
          is_seed: false,
          is_nursery: false,
          stage_badge: '🧅 食用（本圃）認可',
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

      const group = groupedMap.get(regNo)!;
      if (isEdible) group.is_edible = true;
      if (isSeed) group.is_seed = true;
      if (isNursery) group.is_nursery = true;

      // 代表バッジの設定
      if (group.is_seed) group.stage_badge = '🌱 採種用（種採り）認可';
      else if (group.is_nursery && !group.is_edible) group.stage_badge = '🌿 育苗期 専用認可';
      else group.stage_badge = '🧅 食用（本圃）認可';

      if (u.target_pest && u.target_pest !== '-') {
        group.target_pests.add(u.target_pest);
      }
      group.usages_list.push({
        target_pest: u.target_pest || '-',
        usage_amount: u.usage_amount || '-',
        usage_time: u.usage_time || '-',
        usage_method: u.usage_method || '-',
        usage_count: u.usage_count || '-'
      });
    });

    const pesticides = Array.from(groupedMap.values()).map(g => ({
      ...g,
      target_pest: Array.from(g.target_pests).join(', ') || '全般',
      target_pests_array: Array.from(g.target_pests)
    }));

    // ステージ集計（必ず全ステージを集計して常設返却）
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
      message: `作物「${cleanCropName}」に正式登録されている農薬一覧です。（計${filteredPesticides.length}剤）`,
      pesticides: filteredPesticides
    });

  } catch (error: any) {
    console.error('Pesticide Check Error:', error);
    return NextResponse.json({ error: `サーバーエラー: ${error.message}` }, { status: 500 });
  }
}
