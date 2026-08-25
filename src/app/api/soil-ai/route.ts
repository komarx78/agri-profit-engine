import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini APIキーが設定されていません。環境変数 GEMINI_API_KEY を設定してください。' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const body = await req.json();
    const { action } = body;

    // ------------------------------------------------------------------------
    // 1. 📸 土壌診断票（写真・PDF）の AI-OCR 自動読み取り
    // ------------------------------------------------------------------------
    if (action === 'ocr_soil_sheet') {
      const { imageBase64 } = body;
      if (!imageBase64) {
        return NextResponse.json({ error: '画像データがありません' }, { status: 400 });
      }

      const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたは日本の農業土壌分析センターおよびJAの検査報告書を解析する最高峰のAI-OCRエンジンです。
添付された土壌診断結果票（検査成績書・カルテ）の画像を精密に読み取り、以下の測定項目を抽出して純粋なJSONのみで出力してください。
マークダウン記法（\`\`\`jsonなど）は含めず、純粋なJSONテキストのみを返してください。
読み取れない項目や記載がない項目は null にしてください。

【抽出項目】
- diagnosis_date: 診断日または採取日 (YYYY-MM-DD形式。例: "2026-08-25")
- agency_name: 診断機関名 (例: "JA〇〇 土壌分析センター", "みどり総合研究所" など)
- soil_type: 土性 (例: "砂土", "砂壌土", "壌土", "植壌土", "植土", "黒ボク土" のいずれか、または記載の土性)
- ph: 土壌酸度 pH(H2O) (数値。例: 6.2)
- ec: 電気伝導度 EC (mS/cm または dS/m。数値。例: 0.35)
- cec: 塩基置換容量 CEC (meq/100g または cmol(+)/kg。数値。例: 18.0)
- humus_percent: 腐植含有率 (%) (数値。例: 3.5)
- available_p_mg: 有効態りん酸 (mg/100g または トルオーグ/ブレイP2O5。数値。例: 20.0) ※mg/kgの場合は10で割ってmg/100gに換算
- exchangeable_k_mg: 置換性加里 K2O (mg/100g。数値。例: 22.0)
- exchangeable_ca_mg: 置換性石灰 CaO (mg/100g。数値。例: 280.0)
- exchangeable_mg_mg: 置換性苦土 MgO (mg/100g。数値。例: 45.0)
- inorganic_n_mg: 無機態窒素 (mg/100g。数値。例: 2.5)

【出力形式】
{
  "diagnosis_date": "2026-08-25",
  "agency_name": "JA土壌分析センター",
  "soil_type": "壌土",
  "ph": 6.2,
  "ec": 0.35,
  "cec": 18.0,
  "humus_percent": 3.5,
  "available_p_mg": 20.0,
  "exchangeable_k_mg": 22.0,
  "exchangeable_ca_mg": 280.0,
  "exchangeable_mg_mg": 45.0,
  "inorganic_n_mg": 2.5
}
`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg',
          },
        },
      ]);

      const text = result.response.text().trim();
      const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanedJson);

      return NextResponse.json({ success: true, data: parsedData });
    }

    // ------------------------------------------------------------------------
    // 2. ✨ 全データ連携型 AI土壌診断 ＆ 施肥処方箋 自動生成
    // ------------------------------------------------------------------------
    if (action === 'generate_prescription') {
      const {
        fieldName,
        fieldAreaSize,
        currentCropName,
        variety,
        recentFertilizers,
        userMaterials,
        soilData,
      } = body;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたは日本の農研機構・都道府県農業改良普及センターの最高峰の土壌肥料専門技術員です。
これから土づくりを本格化する農家様や若手スタッフ・後継者の方にも直感的にわかりやすく、かつプロ農家も納得する極めて実践的で正確な「総合所見」と「施肥・土壌改良処方箋」を作成してください。

マークダウン記法（\`\`\`jsonなど）は含めず、純粋なJSONテキストのみを返してください。

【農場・圃場コンテキスト】
- 圃場名: ${fieldName || '対象圃場'} (面積: ${fieldAreaSize || '未指定'} a)
- 今作の予定・生育作物: ${currentCropName || '一般野菜'} ${variety ? `(${variety})` : ''}
- 直近の施肥・作業履歴: ${recentFertilizers && recentFertilizers.length > 0 ? recentFertilizers.join(', ') : '特になし（または未記録）'}
- 当農園で登録・在庫している自社資材マスタ: ${userMaterials && userMaterials.length > 0 ? userMaterials.join(', ') : '一般的な市販肥料・苦土石灰・完熟堆肥'}

【今回の土壌診断測定値】
- 土壌酸度 pH(H2O): ${soilData.ph} (適正基準: 6.0〜6.8。好石灰性は6.5〜7.0、ジャガイモ等は5.0〜5.5)
- 電気伝導度 EC: ${soilData.ec} mS/cm (適正基準: 0.2〜0.6)
- 塩基置換容量 CEC (保肥力): ${soilData.cec} meq/100g (目安: 15〜25)
- 腐植含有率: ${soilData.humus_percent || 0} % (目安: 3.0〜5.0%)
- 有効態リン酸: ${soilData.available_p_mg || 0} mg/100g (適正基準: 10〜30mg。30mg超は減肥推奨、50mg超は半減〜完全カット)
- 置換性加里 (K2O): ${soilData.exchangeable_k_mg || 0} mg/100g (適正基準: 15〜30mg)
- 置換性石灰 (CaO): ${soilData.exchangeable_ca_mg || 0} mg/100g (適正基準: 200〜350mg)
- 置換性苦土 (MgO): ${soilData.exchangeable_mg_mg || 0} mg/100g (適正基準: 25〜60mg)
- 塩基飽和度: ${soilData.base_saturation_percent || 0} % (理想: 60〜80%)
- 石灰苦土比 (CaO/MgO): ${soilData.ca_mg_ratio || 0} (理想: 4.0〜6.0)
- 苦土加里比 (MgO/K2O): ${soilData.mg_k_ratio || 0} (理想: 2.0〜3.0)

【診断・処方箋作成の要件】
1. diagnosis_summary (総合所見・コメント):
   - 酸度(pH)、保肥力(CEC)、塩基バランス(Ca/Mg/K比率)、リン酸の蓄積状態、ECの塩類集積度を端的に要約。
   - 今作の作物特性（${currentCropName || '作物'}）に合わせた現在の土壌適合度を述べる。
2. improvement_recommendations (施肥・土壌改良処方箋):
   - ① 石灰・pH矯正の具体指示（苦土石灰や炭カルの必要施用量 kg/10a）
   - ② 有効態リン酸・加里の蓄積に応じた「基肥の増減肥％（例: リン酸元肥を3割減肥など）」
   - ③ 自社マスタ資材（${userMaterials && userMaterials.length > 0 ? userMaterials.slice(0, 3).join('、') : '完熟堆肥等'}）を活用した、10aあたりおよび圃場面積（${fieldAreaSize || 10}a）全体での推奨投入量。
   - ④ 現場のスタッフがそのまま作業できる具体的箇条書き（3〜4項目）。

【出力形式】
{
  "diagnosis_summary": "土壌酸度 pH 6.2・保肥力 CEC 18.0 はともに適正範囲で健全です。...",
  "improvement_recommendations": "① 元肥の加里を20%減肥してください。\n② 完熟堆肥を10aあたり1.5t施用し...\n③ ..."
}
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanedJson);

      return NextResponse.json({ success: true, data: parsedData });
    }

    return NextResponse.json({ error: '不明なアクションです' }, { status: 400 });

  } catch (error: any) {
    console.error('Soil AI Error:', error);
    return NextResponse.json(
      { error: `AI処理に失敗しました: ${error.message}` },
      { status: 500 }
    );
  }
}
