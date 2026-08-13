const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// .env.local を手動でパース
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=(.+)/);
if (match) {
  process.env.GEMINI_API_KEY = match[1].trim();
}

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing in .env.local");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const name = "キャベツ";
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

  console.log("Requesting translation...");
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    console.log("Raw response:", text);

    text = text.replace(/```json\n/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);
    console.log("Parsed JSON:", parsed);
  } catch (err) {
    console.error("Error:", err);
  }
}

testGemini();
