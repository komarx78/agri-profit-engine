"use server";

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTranslatedWorkType, LanguageCode } from '@/lib/i18n';

// Gemini API の初期化
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// 基本的な農業・タスク単語の高速ローカル辞書
const BASIC_DICTIONARY: Record<string, Record<string, string>> = {
  'テスト': { en: 'Test', vi: 'Kiểm tra', id: 'Uji coba', zh: '测试', si: 'පරීක්ෂණය', km: 'ការសាកល្បង' },
  'テスト1': { en: 'Test 1', vi: 'Kiểm tra 1', id: 'Uji coba 1', zh: '测试 1', si: 'පරීක්ෂණය 1', km: 'ការសាកល្បង 1' },
  'テスト2': { en: 'Test 2', vi: 'Kiểm tra 2', id: 'Uji coba 2', zh: '测试 2', si: 'පරීක්ෂණය 2', km: 'ការសាកល្បង 2' },
  'テスト3': { en: 'Test 3', vi: 'Kiểm tra 3', id: 'Uji coba 3', zh: '测试 3', si: 'පරීක්ෂණය 3', km: 'ការសាកល្បង 3' },
  '施肥': { en: 'Fertilizing', vi: 'Bón phân', id: 'Pemupukan', zh: '施肥', si: 'පොහොර යෙදීම', km: 'ការដាក់ជី' },
  '施肥 (元肥)': { en: 'Basal Fertilization', vi: 'Bón lót', id: 'Pemupukan Dasar', zh: '施基肥', si: 'මූලික පොහොර', km: 'ការដាក់ជីទ្រាប់បាត' },
  '施肥 (追肥)': { en: 'Top Dressing Fertilization', vi: 'Bón thúc', id: 'Pemupukan Susulan', zh: '施追肥', si: 'අතිරේක පොහොර', km: 'ការដាក់ជីបំប៉ន' },
  '農薬散布': { en: 'Pesticide Spraying', vi: 'Phun thuốc BVTV', id: 'Penyemprotan Pestisida', zh: '喷洒农药', si: 'කෘමිනාශක ඉසීම', km: 'ការបាញ់ថ្នាំសម្លាប់សត្វល្អិត' },
  '播種': { en: 'Seeding / Sowing', vi: 'Gieo hạt', id: 'Penyemaian', zh: '播种', si: 'බීජ වැපිරීම', km: 'ការព្រោះគ្រាប់' },
  '定植': { en: 'Planting / Transplanting', vi: 'Trồng cây', id: 'Penanaman', zh: '定植', si: 'පැල සිටුවීම', km: 'ការដាំកូនឈើ' },
  '収穫': { en: 'Harvesting', vi: 'Thu hoạch', id: 'Panen', zh: '收获', si: 'අස්වනු නෙලීම', km: 'ការប្រមូលផល' },
  '除草': { en: 'Weeding', vi: 'Làm cỏ', id: 'Penyiangan', zh: '除草', si: 'වල් පැලෑටි නෙලීම', km: 'ការដកស្មៅ' },
  '剪定': { en: 'Pruning', vi: 'Cắt tỉa cành', id: 'Pemangkasan', zh: '修剪', si: 'කප්පාදු කිරීම', km: 'ការកាត់មែក' },
  '水やり': { en: 'Watering', vi: 'Tưới nước', id: 'Penyiraman', zh: '浇水', si: 'වතුර දැමීම', km: 'ការស្រោចទឹក' },
  '出荷': { en: 'Shipping / Delivery', vi: 'Giao hàng', id: 'Pengiriman', zh: '出货', si: 'නැව්ගත කිරීම', km: 'ការដឹកជញ្ជូន' },
  '片付け': { en: 'Cleaning up', vi: 'Dọn dẹp', id: 'Membersihkan', zh: '整理收拾', si: 'පිරිසිදු කිරීම', km: 'ការរៀបចំសម្អាត' },
  '耕起': { en: 'Plowing / Tilling', vi: 'Cày xới đất', id: 'Membajak tanah', zh: '耕地', si: 'බිම් පෙරලීම', km: 'ការភ្ជួររាស់' },
  '畝立て': { en: 'Ridging / Bed making', vi: 'Lên luống', id: 'Membuat bedengan', zh: '起垄', si: 'වැටි සෑදීම', km: 'ការលើករង' },
  'マルチ張り': { en: 'Mulching', vi: 'Trải màng phủ', id: 'Memasang mulsa', zh: '覆地膜', si: 'මල්චිං කිරීම', km: 'ការក្រាលកៅស៊ូ' }
};

// 自由入力テキスト（タスク名など）を任意の言語へ単発翻訳する関数
export async function translateSingleText(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === 'ja') return text;

  // 1. 高速ローカル辞書の一致確認
  const trimmed = text.trim();
  if (BASIC_DICTIONARY[trimmed] && BASIC_DICTIONARY[trimmed][targetLang]) {
    return BASIC_DICTIONARY[trimmed][targetLang];
  }

  // 2. 作業タイプ辞書の確認
  const workTypeTrans = getTranslatedWorkType(trimmed, targetLang as LanguageCode);
  if (workTypeTrans && workTypeTrans !== trimmed) {
    return workTypeTrans;
  }

  // 3. Gemini API によるインテリジェント多言語翻訳
  if (genAI) {
    try {
      const langNames: Record<string, string> = {
        en: 'English',
        vi: 'Vietnamese',
        id: 'Indonesian',
        zh: 'Simplified Chinese',
        si: 'Sinhala',
        km: 'Khmer'
      };
      const langName = langNames[targetLang] || targetLang;

      const prompt = `Translate the following Japanese agricultural work task title into ${langName}.
Return ONLY the translated short title without quotes, explanations, or punctuation.

Japanese: "${trimmed}"`;

      let model;
      try {
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      } catch (e) {
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      }

      const res = await model.generateContent(prompt);
      const translated = res.response.text().trim();
      if (translated) return translated;
    } catch (err) {
      console.warn('Gemini translate error in server action:', err);
    }
  }

  return text;
}

// マスタデータ一括自動翻訳
export async function autoTranslateMasterData(name: string) {
  try {
    if (!name) {
      return { name_en: '', name_vi: '', name_id: '', name_zh: '', name_si: '', name_km: '' };
    }

    const [en, vi, id, zh, si, km] = await Promise.all([
      translateSingleText(name, 'en'),
      translateSingleText(name, 'vi'),
      translateSingleText(name, 'id'),
      translateSingleText(name, 'zh'),
      translateSingleText(name, 'si'),
      translateSingleText(name, 'km'),
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
