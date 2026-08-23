const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /plugins=\{\[dayGridPlugin, timeGridPlugin, interactionPlugin\]\}/,
  "plugins={[dayGridPlugin as any, timeGridPlugin as any, interactionPlugin as any]}"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed FullCalendar TS errors');
