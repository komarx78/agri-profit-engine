const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'src/lib/i18n.ts');
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

// 重複したキーをリネーム
i18nContent = i18nContent.replace(/  logout: \{ ja: 'ログアウト',/g, "  portal_logout: { ja: 'ログアウト',");
i18nContent = i18nContent.replace(/  clockIn: \{ ja: '出勤する',/g, "  portal_clockIn: { ja: '出勤する',");
i18nContent = i18nContent.replace(/  clockOut: \{ ja: '退勤する',/g, "  portal_clockOut: { ja: '退勤する',");
i18nContent = i18nContent.replace(/  today: \{ ja: '今日',/g, "  portal_today: { ja: '今日',");
fs.writeFileSync(i18nPath, i18nContent, 'utf8');

const portalPath = path.join(__dirname, 'src/app/portal/page.tsx');
let portalContent = fs.readFileSync(portalPath, 'utf8');
portalContent = portalContent.replace(/\{t\('logout', language\)\}/g, "{t('portal_logout', language)}");
portalContent = portalContent.replace(/\{t\('clockIn', language\)\}/g, "{t('portal_clockIn', language)}");
portalContent = portalContent.replace(/\{t\('clockOut', language\)\}/g, "{t('portal_clockOut', language)}");
fs.writeFileSync(portalPath, portalContent, 'utf8');

const cwPath = path.join(__dirname, 'src/components/CalendarWrapper.tsx');
let cwContent = fs.readFileSync(cwPath, 'utf8');
cwContent = cwContent.replace(/t\('today'\)/g, "t('portal_today')");
fs.writeFileSync(cwPath, cwContent, 'utf8');

console.log('Fixed duplicated i18n keys');
