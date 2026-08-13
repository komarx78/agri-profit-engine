"use server";

// Note: To use this, you need to install @google-cloud/translate
// npm install @google-cloud/translate

import { v2 } from '@google-cloud/translate';

// 環境変数 GOOGLE_APPLICATION_CREDENTIALS が設定されている前提で動く
// または直接 key を渡すことも可能ですが、OCRのときと同じ環境変数を想定
const translate = new v2.Translate();

export async function translateText(text: string, targetLanguage: string) {
  try {
    if (!text) return text;
    
    // APIを呼び出して翻訳
    const [translation] = await translate.translate(text, targetLanguage);
    return translation;
  } catch (error) {
    console.error(`Translation error for ${targetLanguage}:`, error);
    // エラー時は元のテキストをそのまま返す
    return text;
  }
}

export async function autoTranslateMasterData(name: string) {
  try {
    // 4言語へ並列で翻訳リクエストを投げる
    const [en, vi, id, zh] = await Promise.all([
      translateText(name, 'en'),
      translateText(name, 'vi'),
      translateText(name, 'id'),
      translateText(name, 'zh-CN'), // 中国語(簡体)は zh-CN
    ]);

    return {
      name_en: en,
      name_vi: vi,
      name_id: id,
      name_zh: zh,
    };
  } catch (error) {
    console.error("Auto translation failed:", error);
    return {
      name_en: '',
      name_vi: '',
      name_id: '',
      name_zh: '',
    };
  }
}
