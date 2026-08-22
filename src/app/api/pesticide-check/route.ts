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

export async function POST(request: Request) {
  try {
    const { cropName, pesticideName, targetPest, usageAmount } = await request.json();

    const cleanCropName = cropName?.trim() || '';
    const cleanTargetPest = targetPest?.trim() || '';

    if (!cleanCropName) {
      return NextResponse.json(
        { error: '作物名は必須です。' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let usages: any[] = [];
    let dbError = null;

    // Supabaseの1000件制限を突破して全件取得するヘルパー関数
    async function fetchAllRows(queryBuilder: any) {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await queryBuilder.range(from, from + step - 1);
        if (error) {
          dbError = error;
          break;
        }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < step) break; // 1000件未満ならループ終了（最後まで取得した）
        from += step;
      }
      return allData;
    }

    // 1. 完全一致・部分一致検索 (平仮名・カタカナの揺らぎ対応)
    const kanaName = toKatakana(cleanCropName);
    const halfKanaName = toHalfWidthKana(kanaName);

    let query = supabase
      .from('m_pesticide_usages')
      .select('*')
      .like('crop_name', `%${cleanCropName}%`);
      
    if (cleanTargetPest) {
       query = query.like('target_pest', `%${cleanTargetPest}%`);
    }

    usages = await fetchAllRows(query);

    if (!usages || usages.length === 0) {
      let fallbackQuery = supabase
        .from('m_pesticide_usages')
        .select('*')
        .like('crop_name', `%${halfKanaName}%`); 
        
      if (cleanTargetPest) {
         const kanaPest = toKatakana(cleanTargetPest);
         const halfKanaPest = toHalfWidthKana(kanaPest);
         fallbackQuery = fallbackQuery.like('target_pest', `%${halfKanaPest}%`);
      }
      
      usages = await fetchAllRows(fallbackQuery);
      
      if (!usages || usages.length === 0) {
         let fallbackQuery2 = supabase
          .from('m_pesticide_usages')
          .select('*')
          .like('crop_name', `%${kanaName}%`);
          
        if (cleanTargetPest) {
           const kanaPest = toKatakana(cleanTargetPest);
           fallbackQuery2 = fallbackQuery2.like('target_pest', `%${kanaPest}%`);
        }
        usages = await fetchAllRows(fallbackQuery2);
      }
    }

    // 3. 【最終手段】SQLの .like() バグ回避用 JS強制フィルタ
    if ((!usages || usages.length === 0) && !dbError) {
      // 最終手段の全件なめは重すぎるので、直近10000件だけにする
      const { data: bulkData } = await supabase
          .from('m_pesticide_usages')
          .select('*')
          .limit(10000)
          .order('created_at', { ascending: false });

      if (bulkData) {
          const jsFiltered = bulkData.filter(row => {
              if (!row.crop_name) return false;
              return row.crop_name.includes(cleanCropName) || 
                     row.crop_name.includes(kanaName) || 
                     row.crop_name.includes(halfKanaName);
          });
          if (jsFiltered.length > 0) {
              usages = jsFiltered;
          }
      }
    }

    if (dbError) {
       return NextResponse.json({ error: `データベース検索エラー: ${dbError.message}` }, { status: 500 });
    }
    
    if (usages && usages.length > 0) {
       // 全件取得したため、pesticidesの取得もループで分割して行う（IN句の数上限エラーを防ぐため）
       const regNos = Array.from(new Set(usages.map((u: any) => u.registration_no))); // 重複排除
       const pestMap = new Map();
       
       const chunkSize = 500;
       for (let i = 0; i < regNos.length; i += chunkSize) {
         const chunk = regNos.slice(i, i + chunkSize);
         const { data: pestData } = await supabase
           .from('m_pesticides')
           .select('registration_no, pesticide_name, pesticide_type, applicant_name')
           .in('registration_no', chunk);
           
         if (pestData) {
            pestData.forEach(p => pestMap.set(p.registration_no, p));
         }
       }

       const pesticides = usages.map((u: any) => {
          const pInfo = pestMap.get(u.registration_no) || {};
          return {
            name: pInfo.pesticide_name || '名称不明',
            type: pInfo.pesticide_type || '-',
            applicant: pInfo.applicant_name || '-',
            registration_no: u.registration_no,
            target_pest: u.target_pest || '-',
            usage_amount: u.usage_amount || '-',
            usage_time: u.usage_time || '-',
            usage_method: u.usage_method || '-',
            usage_count: u.usage_count || '-'
          };
       });

       return NextResponse.json({
          judgment: 'DB検索完了',
          message: `FAMICデータベースより、作物「${cleanCropName}」に関連する農薬の検索結果です。`,
          pesticides: pesticides
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
