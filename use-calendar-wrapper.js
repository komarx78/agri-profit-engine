const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. 古いインポートを削除し、dynamic import に置き換える
content = content.replace(
  /import FullCalendar from '@fullcalendar\/react';\nimport dayGridPlugin from '@fullcalendar\/daygrid';\nimport timeGridPlugin from '@fullcalendar\/timegrid';\nimport interactionPlugin from '@fullcalendar\/interaction';/,
  "import dynamic from 'next/dynamic';\n\nconst CalendarWrapper = dynamic(() => import('@/components/CalendarWrapper'), { ssr: false, loading: () => <div className=\"h-[600px] flex items-center justify-center\"><div className=\"w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin\"></div></div> });"
);

// 2. JSX の FullCalendar を CalendarWrapper に置き換える
// <FullCalendar ... /> を置換する
const oldCalendarRegex = /<FullCalendar[\s\S]*?buttonText=\{\{[\s\S]*?\}\}\n\s*\/>/;
content = content.replace(oldCalendarRegex, "<CalendarWrapper events={calendarEvents} />");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced FullCalendar with dynamic CalendarWrapper');
