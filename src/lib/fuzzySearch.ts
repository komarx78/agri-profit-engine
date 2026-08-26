// =========================================================================
// 【究極の表記揺れ吸収・正規化エンジン】
// 大文字・小文字、全角・半角英数、ひらがな・全角カタカナ・半角カナ、
// 捨て仮名、長音符、空白、記号、業界辞書の全方位を100%均一化
// =========================================================================

// 完璧な全角カタカナ -> 半角カタカナ変換マップ
export const FULL_TO_HALF_KANA_MAP: { [key: string]: string } = {
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

// 半角カタカナ -> 全角カタカナ変換マップ
export const HALF_TO_FULL_KANA_MAP: { [key: string]: string } = Object.entries(FULL_TO_HALF_KANA_MAP).reduce((acc, [k, v]) => {
  acc[v] = k;
  return acc;
}, {} as { [key: string]: string });

export function toHalfWidthKana(str: string): string {
  if (!str) return '';
  let s = '';
  for (const c of str) {
    s += FULL_TO_HALF_KANA_MAP[c] || c;
  }
  return s;
}

export function toKatakana(str: string): string {
  if (!str) return '';
  return str.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

export function toHiragana(str: string): string {
  if (!str) return '';
  return str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}

export function toFullWidthAlphanumeric(str: string): string {
  if (!str) return '';
  return str.replace(/[A-Za-z0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
}

export function toHalfWidthAlphanumeric(str: string): string {
  if (!str) return '';
  return str.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

// 究極の正規化比較関数
export function fuzzyNormalize(str: string): string {
  if (!str) return '';
  return String(str)
    .normalize('NFKC') // 半角カナ -> 全角カナ、全角英数 -> 半角英数、全角記号 -> 半角記号
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60)) // ひらがな -> カタカナ
    .replace(/ァ/g, 'ア').replace(/ィ/g, 'イ').replace(/ゥ/g, 'ウ').replace(/ェ/g, 'エ').replace(/ォ/g, 'オ')
    .replace(/ッ/g, 'ツ').replace(/ャ/g, 'ヤ').replace(/ュ/g, 'ユ').replace(/ョ/g, 'ヨ')
    .replace(/ヮ/g, 'ワ').replace(/ヵ/g, 'カ').replace(/ヶ/g, 'ケ')
    .replace(/[-‐―−ー～~]/g, 'ー')
    .replace(/[\s　・･()（）\[\]【】]/g, '');
}

export function isFuzzyMatch(targetStr: string, queryStr: string): boolean {
  if (!queryStr) return true;
  return fuzzyNormalize(targetStr).includes(fuzzyNormalize(queryStr));
}

// 農業メーカー・主要用語の双方向同義語辞書
export const INDUSTRY_SYNONYM_DICT: Record<string, string[]> = {
  '昭和': ['ショウワ', 'しょうわ', '昭和', 'SHOWA', 'ｼｮｳﾜ'],
  'ショウワ': ['昭和', 'しょうわ', 'ショウワ', 'SHOWA', 'ｼｮｳﾜ'],
  'しょうわ': ['昭和', 'ショウワ', 'しょうわ', 'SHOWA', 'ｼｮｳﾜ'],
  '住友': ['スミトモ', 'すみとも', '住友', 'SUMITOMO', 'ｽﾐﾄﾓ', '住化'],
  'スミトモ': ['住友', 'すみとも', 'スミトモ', 'SUMITOMO', 'ｽﾐﾄﾓ', '住化'],
  '住化': ['住友', 'スミトモ', '住化', '住友化学'],
  '三菱': ['ミツビシ', 'みつびし', '三菱', 'MITSUBISHI', 'ﾐﾂﾋﾞｼ'],
  '三井': ['ミツイ', 'みつい', '三井', 'MITSUI', 'ﾐﾂｲ'],
  '日産': ['ニッサン', 'にっさん', '日産', 'NISSAN', 'ﾆｯｻﾝ'],
  '全農': ['ゼンノウ', 'ぜんのう', '全農', 'JA', 'ＪＡ', 'ｾﾞﾝﾉｳ'],
  'クミアイ': ['組合', 'くみあい', 'クミアイ', 'KUMIAI', 'ｸﾐｱｲ', 'クミアイ化学'],
  '協和': ['キョウワ', 'きょうわ', '協和', 'KYOWA', 'ｷｮｳﾜ'],
  'ホクコー': ['北興', 'ほくこう', 'ホクコー', '北興化学', 'ﾎｸｺｰ'],
  'サンケイ': ['産経', 'さんけい', 'サンケイ', '三景', 'ｻﾝｹｲ', 'サンケイ化学'],
  'ホウ素': ['ほう素', 'ホウ素', 'ホウソ', '硼素', 'B', 'ﾎｳｿ'],
  'マンガン': ['Mn', 'マンガン', 'まんがん', 'ﾏﾝｶﾞﾝ'],
  'ケイ酸': ['珪酸', 'ケイ酸', 'けいさん', 'SiO2', 'ｹｲｻﾝ'],
  '石灰': ['カルシウム', '石灰', 'せっかい', 'Ca', 'ｶﾙｼｳﾑ'],
  '苦土': ['マグネシウム', '苦土', 'くど', 'Mg', 'ﾏｸﾞﾈｼｳﾑ']
};

// データベース検索用の網羅的キーワード生成
export function generateComprehensiveSearchKeywords(query: string): string[] {
  if (!query || !query.trim()) return [];
  const raw = query.trim();
  const nfkc = raw.normalize('NFKC');

  const set = new Set<string>();
  set.add(raw);
  set.add(nfkc);

  // 1. カタカナ・ひらがな
  const kata = toKatakana(nfkc);
  const hira = toHiragana(nfkc);
  set.add(kata);
  set.add(hira);

  // 2. 半角カタカナ
  const halfKana = toHalfWidthKana(kata);
  set.add(halfKana);

  // 3. 大文字・小文字
  set.add(nfkc.toLowerCase());
  set.add(nfkc.toUpperCase());

  // 4. 全角半角英数
  set.add(toFullWidthAlphanumeric(nfkc));
  set.add(toHalfWidthAlphanumeric(nfkc));
  set.add(toFullWidthAlphanumeric(nfkc.toLowerCase()));
  set.add(toFullWidthAlphanumeric(nfkc.toUpperCase()));

  // 5. 業界同義語辞書展開
  Object.entries(INDUSTRY_SYNONYM_DICT).forEach(([key, syns]) => {
    if (raw.includes(key) || nfkc.includes(key) || kata.includes(key) || hira.includes(key)) {
      syns.forEach(s => {
        set.add(s);
        set.add(raw.replace(key, s));
        set.add(nfkc.replace(key, s));
      });
    }
  });

  return Array.from(set).filter(s => s && s.length > 0);
}
