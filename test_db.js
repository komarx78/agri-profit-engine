process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');

const envContent = fs.readFileSync('c:\\Users\\koma\\OneDrive - 株式会社cocotte\\GAS職人\\農業システム\\agri-profit-engine\\.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const FULL_TO_HALF_KANA_MAP = {
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

function toHalfWidthKana(str) {
  if (!str) return '';
  let s = '';
  for (const c of str) {
    s += FULL_TO_HALF_KANA_MAP[c] || c;
  }
  return s;
}

function toKatakana(str) {
  if (!str) return '';
  return str.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}

function toHiragana(str) {
  if (!str) return '';
  return str.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
}

function toFullWidthAlphanumeric(str) {
  if (!str) return '';
  return str.replace(/[A-Za-z0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
}

function fuzzyNormalize(str) {
  if (!str) return '';
  let s = String(str)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60))
    .replace(/ァ/g, 'ア').replace(/ィ/g, 'イ').replace(/ゥ/g, 'ウ').replace(/ェ/g, 'エ').replace(/ォ/g, 'オ')
    .replace(/ッ/g, 'ツ').replace(/ャ/g, 'ヤ').replace(/ュ/g, 'ユ').replace(/ョ/g, 'ヨ')
    .replace(/ヮ/g, 'ワ').replace(/ヵ/g, 'カ').replace(/ヶ/g, 'ケ')
    .replace(/ダイヤ/g, 'ダイア')
    .replace(/[-‐―−ー～~]/g, 'ー')
    .replace(/[\s　・･()（）\[\]【】]/g, '');
  return s;
}

function isFuzzyMatch(targetStr, queryStr) {
  if (!queryStr) return true;
  return fuzzyNormalize(targetStr).includes(fuzzyNormalize(queryStr));
}

function generateSearchVariants(raw) {
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

  const variants = new Set([
    rawClean, nfkc,
    kata, hira, halfKana,
    lower, upper,
    fullAlpha, fullAlphaLower, fullAlphaUpper,
    halfKataLower, halfKataUpper
  ]);

  return Array.from(variants).filter(s => s && s.length > 0);
}

async function testPesticideSearch(query) {
  const pVariants = generateSearchVariants(query);
  const orParams = pVariants.map(p => `pesticide_name.ilike.*${encodeURIComponent(p)}*`).join(',');
  const url = `${supabaseUrl}/rest/v1/m_pesticides?select=registration_no,pesticide_name&or=(${orParams})&limit=50`;

  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const matchedPests = await res.json();
    if (!Array.isArray(matchedPests)) {
      console.error(`Error for "${query}":`, matchedPests);
      return 0;
    }
    const filtered = matchedPests.filter(p => isFuzzyMatch(p.pesticide_name, query));
    return filtered.length;
  } catch (e) {
    console.error(`Fetch error for "${query}":`, e);
    return 0;
  }
}

async function runAllTests() {
  console.log('=== 実DB（m_pesticides）に対する大文字・小文字・全角・半角・カナの全方位テスト開始 ===\n');

  const testQueries = [
    // BT水和剤（大文字・小文字・全角・半角）
    'BT', 'bt', 'ＢＴ', 'ｂｔ', 'チューンアップ', 'ﾁｭｰﾝｱｯﾌﾟ', 'ちゅーんあっぷ',
    // ICボルドー（大文字・小文字・全角・半角）
    'IC', 'ic', 'ＩＣ', 'ｉｃ', 'ボルドー', 'ぼるどー', 'ﾎﾞﾙﾄﾞｰ',
    // DF・顆粒水和剤（大文字・小文字・全角・半角）
    'DF', 'df', 'ＤＦ', 'ｄｆ', 'アグロケア', 'ｱｸﾞﾛｹｱ',
    // スミレックス・スミチオン（全角・半角・ひらがな）
    'スミレックス', 'すみれっくす', 'ｽﾐﾚｯｸｽ', 'スミチオン', 'すみちおん', 'ｽﾐﾁｵﾝ',
    // スタークル・アルバリン
    'スタークル', 'すたーくる', 'ｽﾀｰｸﾙ', 'アルバリン', 'あるばりん', 'ｱﾙﾊﾞﾘﾝ',
    // ダイアジノン
    'ダイアジノン', 'ﾀﾞｲｱｼﾞﾉﾝ',
    // オルトラン
    'オルトラン', 'おるとらん', 'ｵﾙﾄﾗﾝ'
  ];

  let passed = 0;
  let failed = 0;

  for (const q of testQueries) {
    const count = await testPesticideSearch(q);
    if (count > 0) {
      console.log(`✅ [PASS] 検索キーワード: "${q}" -> ${count} 件ヒット！`);
      passed++;
    } else {
      console.error(`❌ [FAIL] 検索キーワード: "${q}" -> 0 件ヒット`);
      failed++;
    }
  }

  console.log(`\n=== テスト完了結果 ===`);
  console.log(`合格: ${passed} / 全 ${testQueries.length} パターン (成功率: ${((passed / testQueries.length) * 100).toFixed(1)}%)`);

  if (failed === 0) {
    console.log(`\n🎉 実DBに対する全パターンの大文字・小文字・全角・半角・カナ検索が100%完全合格しました！`);
  }
}

runAllTests();
