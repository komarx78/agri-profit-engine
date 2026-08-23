const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'src/lib/i18n.ts');
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

// portal_recentTasks がなければ追加
if (!i18nContent.includes('portal_recentTasks')) {
  i18nContent = i18nContent.replace(
    /portal_today: \{ ja: '今日',/g,
    "portal_today: { ja: '今日', en: 'Today', vi: 'Hôm nay', id: 'Hari ini', zh: '今天', si: 'අද', km: 'ថ្ងៃនេះ' },\n  portal_recentTasks: { ja: '直近のタスク・予定', en: 'Recent Tasks', vi: 'Nhiệm vụ gần đây', id: 'Tugas Terbaru', zh: '近期任务', si: 'මෑත කාලීන කාර්යයන්', km: 'ការងារថ្មីៗ' },"
  );
  // もし置換に失敗したら、先頭に足す
  if (!i18nContent.includes('portal_recentTasks')) {
    i18nContent = i18nContent.replace(/export const TRANSLATIONS: Record<string, Record<string, string>> = \{/, `export const TRANSLATIONS: Record<string, Record<string, string>> = {\n  portal_recentTasks: { ja: '直近のタスク・予定', en: 'Recent Tasks', vi: 'Nhiệm vụ gần đây', id: 'Tugas Terbaru', zh: '近期任务', si: 'මෑත කාලීන කාර්යයන්', km: 'ការងារថ្មីៗ' },`);
  }
}

fs.writeFileSync(i18nPath, i18nContent, 'utf8');


const cwPath = path.join(__dirname, 'src/components/CalendarWrapper.tsx');
let cwContent = fs.readFileSync(cwPath, 'utf8');

// tの型を修正
cwContent = cwContent.replace(
  /t: \(key: string\) => string;/,
  "t: (key: string, lang?: any) => string;"
);

// tの呼び出しにlanguageを渡す
cwContent = cwContent.replace(/\{t\("recentTasks"\)\}/g, "{t('portal_recentTasks', language)}");
cwContent = cwContent.replace(/\{t\('portal_recentTasks'\)\}/g, "{t('portal_recentTasks', language)}");
cwContent = cwContent.replace(/\{t\("noTasks"\)\}/g, "{t('noTasksRecent', language)}"); // 既存のキー名に合わせる
cwContent = cwContent.replace(/t\('portal_today'\)/g, "t('portal_today', language)");

fs.writeFileSync(cwPath, cwContent, 'utf8');


const portalPath = path.join(__dirname, 'src/app/portal/page.tsx');
let portalContent = fs.readFileSync(portalPath, 'utf8');

// 会社名のフォールバック
portalContent = portalContent.replace(
  /if \(userData && userData\.name\) setCompanyName\(userData\.name\);/,
  "if (userData) setCompanyName(userData.company_name || userData.farm_name || userData.name || 'Cocotte');"
);

fs.writeFileSync(portalPath, portalContent, 'utf8');

console.log('Fixed i18n keys and CalendarWrapper');
