import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 外部フォールバック用: Google Translate Free REST API (Gemini不通時の多重安全弁)
async function fallbackGoogleTranslate(text: string, targetLangCode: string): Promise<string> {
  try {
    const langMap: Record<string, string> = {
      en: 'en',
      vi: 'vi',
      id: 'id',
      zh: 'zh-CN',
      si: 'si',
      km: 'km'
    };
    const tl = langMap[targetLangCode] || targetLangCode;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item: any) => item[0]).filter(Boolean).join('');
        if (translated) return translated;
      }
    }
  } catch (e) {
    console.warn(`Fallback translation failed for ${targetLangCode}:`, e);
  }
  return text;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetLanguage, targetLanguages } = body;
    const texts: string[] = body.texts || (body.text ? [body.text] : []);
    const textToTranslate = body.text;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

    // Mode A: 1テキストを複数言語へ一括翻訳 (動画テロップ・掲示板投稿など)
    if (targetLanguages && Array.isArray(targetLanguages) && textToTranslate) {
      const langMapping: Record<string, string> = {
        en: 'English',
        vi: 'Vietnamese',
        id: 'Indonesian',
        zh: 'Chinese (Simplified)',
        si: 'Sinhala (Sri Lanka)',
        km: 'Khmer (Cambodia)'
      };

      const requestedList = targetLanguages.map(code => `${code}: ${langMapping[code] || code}`).join('\n');

      const prompt = `Translate the following Japanese agricultural/workplace text into these target languages:
${requestedList}

Return ONLY a valid JSON object where keys EXACTLY match the requested language codes (${targetLanguages.map(c => `"${c}"`).join(', ')}) and values are the natural translated texts.
Do not wrap with markdown blocks.

Text to translate:
${textToTranslate}`;

      let translations: Record<string, string> = {};
      let geminiSuccess = false;

      if (genAI) {
        // 利用可能な現行Geminiモデルの優先チェーン
        const modelsToTry = [
          "gemini-3.6-flash",
          "gemini-3.5-flash",
          "gemini-flash-latest",
          "gemini-3.7-flash",
          "gemini-2.5-pro"
        ];

        for (const modelName of modelsToTry) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: "application/json"
              }
            });
            const result = await model.generateContent(prompt);
            let rawText = result.response.text().trim();
            if (rawText.startsWith('```')) {
              rawText = rawText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
            }

            // JSON抽出 (前後に余計な文字があっても確実にパース)
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            const targetJsonStr = jsonMatch ? jsonMatch[0] : rawText;

            const parsed = JSON.parse(targetJsonStr);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
              // キーの正規化 (大文字小文字や言語名など)
              Object.keys(parsed).forEach(k => {
                const lowerK = k.toLowerCase().trim();
                if (lowerK === 'si' || lowerK.includes('sinhala') || lowerK.includes('sri')) {
                  translations['si'] = parsed[k];
                } else if (lowerK === 'km' || lowerK.includes('khmer') || lowerK.includes('cambodia')) {
                  translations['km'] = parsed[k];
                } else if (lowerK === 'en' || lowerK.includes('english')) {
                  translations['en'] = parsed[k];
                } else if (lowerK === 'vi' || lowerK.includes('vietnam')) {
                  translations['vi'] = parsed[k];
                } else if (lowerK === 'id' || lowerK.includes('indonesia')) {
                  translations['id'] = parsed[k];
                } else if (lowerK === 'zh' || lowerK.includes('chinese')) {
                  translations['zh'] = parsed[k];
                } else {
                  translations[k] = parsed[k];
                }
              });
              geminiSuccess = true;
              break;
            }
          } catch (mErr) {
            console.warn(`Gemini model ${modelName} failed, trying next...:`, mErr);
          }
        }
      }

      // 未翻訳の言語がある場合、またはGeminiが全滅した場合は Google Translate Free API でフォールバック補完！
      for (const code of targetLanguages) {
        if (!translations[code] || translations[code] === textToTranslate) {
          const fb = await fallbackGoogleTranslate(textToTranslate, code);
          translations[code] = fb;
        }
      }

      return NextResponse.json({ translations });
    }

    // Mode B: 複数テキストを1言語へ翻訳
    if (texts.length > 0) {
      const lang = targetLanguage || 'vi';
      const prompt = `Translate the following array of Japanese texts into ${lang}.
Return a valid JSON array of strings containing ONLY the translated texts in the exact same order.

Texts:
${JSON.stringify(texts)}`;

      let translatedTexts: string[] = [];
      let geminiSuccess = false;

      if (genAI) {
        const modelsToTry = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"];
        for (const modelName of modelsToTry) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent(prompt);
            let rawText = result.response.text().trim();
            if (rawText.startsWith('```')) {
              rawText = rawText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
            }
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            const targetJsonStr = jsonMatch ? jsonMatch[0] : rawText;
            const parsed = JSON.parse(targetJsonStr);
            if (Array.isArray(parsed) && parsed.length === texts.length) {
              translatedTexts = parsed;
              geminiSuccess = true;
              break;
            }
          } catch (e) {
            console.warn(`Gemini Mode B model ${modelName} error:`, e);
          }
        }
      }

      if (!geminiSuccess || translatedTexts.length === 0) {
        // フォールバック
        translatedTexts = await Promise.all(
          texts.map(t => fallbackGoogleTranslate(t, lang))
        );
      }

      return NextResponse.json({
        translatedText: translatedTexts[0] || textToTranslate,
        translatedTexts: translatedTexts
      });
    }

    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });

  } catch (error) {
    console.error('Translation error in /api/translate:', error);
    return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
  }
}
