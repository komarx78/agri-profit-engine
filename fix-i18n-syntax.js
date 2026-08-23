const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'src/lib/i18n.ts');
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

// 壊れた行を修正
i18nContent = i18nContent.replace(
  /portal_today: \{ ja: '今日', en: 'Today', vi: 'Hôm nay', id: 'Hari ini', zh: '今天', si: 'අද', km: 'ថ្ងៃនេះ' \},\n  portal_recentTasks: \{ ja: '直近のタスク・予定', en: 'Recent Tasks', vi: 'Nhiệm vụ gần đây', id: 'Tugas Terbaru', zh: '近期任务', si: 'මෑත කාලීන කාර්යයන්', km: 'ការងារថ្មីៗ' \}, en: 'Today', vi: 'Hôm nay', id: 'Hari ini', zh: '今天', si: 'අද', km: 'ថ្ងៃនេះ' \},/g,
  "portal_today: { ja: '今日', en: 'Today', vi: 'Hôm nay', id: 'Hari ini', zh: '今天', si: 'අද', km: 'ថ្ងៃនេះ' },\n  portal_recentTasks: { ja: '直近のタスク・予定', en: 'Recent Tasks', vi: 'Nhiệm vụ gần đây', id: 'Tugas Terbaru', zh: '近期任务', si: 'මෑත කාලීන කාර්යයන්', km: 'ការងារថ្មីៗ' },"
);

fs.writeFileSync(i18nPath, i18nContent, 'utf8');
console.log('Fixed syntax error in i18n.ts');
