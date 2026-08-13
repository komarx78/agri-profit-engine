"use server";

import { GoogleGenerativeAI } from '@google/generative-ai';

// すでにOCRで使っている環境変数を利用する
const apiKey = process.env.GEMINI_API_KEY;

export async function autoTranslateMasterData(name: string) {
  try {
    if (!name) {
      return { name_en: '', name_vi: '', name_id: '', name_zh: '' };
    }
    
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Skipping translation.");
      return { name_en: '', name_vi: '', name_id: '', name_zh: '' };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // 翻訳には軽量で高速な Flash モデルを使用
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `
以下の農業用語（作目、圃場名、作業名など）を4つの言語（英語、ベトナム語、インドネシア語、中国語）に翻訳し、JSON形式のみで出力してください。
マークダウンのコードブロック(\`\`\`json)などは付けずに、純粋なJSONテキストのみを返してください。
専門用語の場合は、農業現場で最も一般的に使われる単語を選んでください。

翻訳対象の単語: "${name}"

【出力フォーマット】
{
  "name_en": "英語の翻訳",
  "name_vi": "ベトナム語の翻訳",
  "name_id": "インドネシア語の翻訳",
  "name_zh": "中国語(簡体字)の翻訳"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Markdownのコードブロックが含まれている場合のクリーニング
    text = text.replace(/```json\n/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsedData = JSON.parse(text);
      return {
        name_en: parsedData.name_en || '',
        name_vi: parsedData.name_vi || '',
        name_id: parsedData.name_id || '',
        name_zh: parsedData.name_zh || '',
      };
    } catch (parseError) {
      console.error('Failed to parse AI translation response:', text);
      return { name_en: '', name_vi: '', name_id: '', name_zh: '' };
    }
  } catch (error) {
    console.error("Auto translation failed:", error);
    return { name_en: '', name_vi: '', name_id: '', name_zh: '' };
  }
}
