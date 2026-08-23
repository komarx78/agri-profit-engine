import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetLanguage, targetLanguages } = body;
    const texts: string[] = body.texts || (body.text ? [body.text] : []);
    const textToTranslate = body.text;

    if (!genAI) {
      console.warn('GEMINI_API_KEY is missing.');
      return NextResponse.json({ error: 'Mock fallback not supported for this mode' }, { status: 500 });
    }

    // Mode A: 1繝・く繧ｹ繝医ｒ隍・焚險€隱槭∈鄙ｻ險ｳ (謚慕ｨｿ譎ら畑)
    if (targetLanguages && Array.isArray(targetLanguages) && textToTranslate) {
      const prompt = `Translate the following Japanese text into the following languages: ${targetLanguages.join(', ')}.
      Return ONLY a valid JSON object where keys are the language codes/names and values are the translated texts.
      Do not include markdown blocks like \`\`\`json.
      
      Text to translate:
      ${textToTranslate}`;

      let result;
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        result = await model.generateContent(prompt);
      } catch (err) {
        console.warn('gemini-3.5-flash failed, falling back to gemini-1.5-flash');
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        result = await fallbackModel.generateContent(prompt);
      }
      let rawText = result.response.text().trim();
      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      return NextResponse.json({ translations: JSON.parse(rawText) });
    }

    // Mode B: 隍・焚繝・く繧ｹ繝医ｒ1險隱槭∈鄙ｻ險ｳ (譌｢蟄倅ｺ呈鋤)
    if (texts.length > 0) {
      const lang = targetLanguage || 'Vietnamese';
      const prompt = `Translate the following array of Japanese texts into ${lang}.
      Return a valid JSON array of strings containing ONLY the translated texts in the exact same order.
      Do not include markdown blocks like \`\`\`json.
      
      Texts:
      ${JSON.stringify(texts)}`;

      let result;
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        result = await model.generateContent(prompt);
      } catch (err) {
        console.warn('gemini-3.5-flash failed, falling back to gemini-1.5-flash');
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        result = await fallbackModel.generateContent(prompt);
      }
      let rawText = result.response.text().trim();
      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
      }

      let translatedTexts: string[];
      try {
        translatedTexts = JSON.parse(rawText);
      } catch (e) {
        console.error('Failed to parse Gemini response as JSON:', rawText);
        translatedTexts = texts.map(() => rawText); 
      }

      return NextResponse.json({ 
        translatedText: translatedTexts[0],
        translatedTexts: translatedTexts 
      });
    }

    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
  }
}
