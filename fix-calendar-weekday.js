const fs = require('fs');
const path = require('path');

const cwPath = path.join(__dirname, 'src/components/CalendarWrapper.tsx');
let cwContent = fs.readFileSync(cwPath, 'utf8');

cwContent = cwContent.replace(
  /dayName: \(language === 'en' \? \['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'\] : language === 'vi' \? \['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'\] : \['日', '月', '火', '水', '木', '金', '土'\]\)\[d\.getDay\(\)\],/g,
  "dayName: new Intl.DateTimeFormat(language, { weekday: 'short' }).format(d),"
);

fs.writeFileSync(cwPath, cwContent, 'utf8');
console.log('Fixed weekday translation in CalendarWrapper');
