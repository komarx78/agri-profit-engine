"use server";

// 環境変数（APIキー）を必要としない無料の簡易翻訳APIを使用
// ※大量のアクセスには適しませんが、マスタ登録時の数件程度の翻訳であれば問題なく動作します。

async function translateTextFree(text: string, targetLanguage: string) {
  try {
    if (!text) return text;
    
    // Google Translateの非公開（ブラウザ向け）API。簡易的な翻訳に利用可能。
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // data[0][0][0] に翻訳結果が入っている
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    }
    return text;
  } catch (error) {
    console.error(`Free translation error for ${targetLanguage}:`, error);
    return text;
  }
}

export async function autoTranslateMasterData(name: string) {
  try {
    if (!name) {
      return { name_en: '', name_vi: '', name_id: '', name_zh: '', name_si: '', name_km: '' };
    }
    
    // 6言語へ並列で翻訳リクエストを投げる
    const [en, vi, id, zh, si, km] = await Promise.all([
      translateTextFree(name, 'en'),
      translateTextFree(name, 'vi'),
      translateTextFree(name, 'id'),
      translateTextFree(name, 'zh-CN'),
      translateTextFree(name, 'si'),
      translateTextFree(name, 'km'),
    ]);

    return {
      name_en: en,
      name_vi: vi,
      name_id: id,
      name_zh: zh,
      name_si: si,
      name_km: km,
    };
  } catch (error) {
    console.error("Auto translation failed:", error);
    return { name_en: '', name_vi: '', name_id: '', name_zh: '', name_si: '', name_km: '' };
  }
}

// 自由入力テキスト（タスク名など）を任意の言語へ単発翻訳する関数
export async function translateSingleText(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === 'ja') return text;
  const langCode = targetLang === 'zh' ? 'zh-CN' : targetLang;
  return await translateTextFree(text, langCode);
}

