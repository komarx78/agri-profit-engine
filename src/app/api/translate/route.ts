import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // TODO: ここに実際のGemini APIやGoogle Cloud Translation APIの呼び出しを実装します。
    // 今回はプロトタイプ用として、簡単な文字列結合によるモックを返します。
    // （実際の運用では、環境変数からAPIキーを取得して外部サービスへリクエストを送ります）

    // モックの遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      english: `[English Auto-Translation] ${text}`,
      vietnamese: `[Bản dịch tiếng Việt] ${text}`
    });

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
  }
}
