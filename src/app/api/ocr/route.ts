import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic'; // Vercelのキャッシュを無効化し、毎回動的に実行する

export async function POST(req: Request) {
  try {
    // APIルートの実行時に環境変数を読み込む（Vercelの静的最適化によるエラーを防ぐため）
    const apiKey = process.env.GEMINI_API_KEY;
    
    // APIキーが設定されていない場合はエラー
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini APIキーが設定されていません。環境変数 GEMINI_API_KEY を設定してください。' },
        { status: 500 }
      );
    }

    // Gemini APIの初期化
    const genAI = new GoogleGenerativeAI(apiKey);

    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: '画像データがありません' }, { status: 400 });
    }

    // Base64プレフィックス（data:image/jpeg;base64, など）を削除
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    // 2026年の最新モデル（Gemini 3.5 Flash）を使用
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `
あなたは優秀な経理アシスタントです。添付されたレシートまたは領収書の画像を読み取り、以下の情報を抽出してJSON形式のみで出力してください。
マークダウンのコードブロック(\`\`\`json)などは付けずに、純粋なJSONテキストのみを返してください。
読み取れない項目がある場合は null または空文字にしてください。

【抽出する情報】
- date: 購入日（YYYY-MM-DD形式。例: 2024-03-15）
- supplier: 購入先（店舗名や会社名など。支店名などは省略可）
- total_amount: 支払った合計金額（税込。カンマを含まない数値のみ。例: 1500）

【出力形式の例】
{
  "date": "2024-03-15",
  "supplier": "〇〇コメリ",
  "total_amount": 1500
}
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg', // 汎用的にJPEGとして処理
        },
      },
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Markdownのコードブロックが含まれている場合のクリーニング
    text = text.replace(/```json\n/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsedData = JSON.parse(text);
      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', text);
      return NextResponse.json({ error: 'AIからの応答が正しいJSON形式ではありませんでした', rawText: text }, { status: 500 });
    }
  } catch (error: any) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: error.message || '画像の解析に失敗しました' }, { status: 500 });
  }
}
