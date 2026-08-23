const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 既存のインポートを削除・変更
content = content.replace(
  /import FullCalendar from '@fullcalendar\/react';\nimport dayGridPlugin from '@fullcalendar\/daygrid';\nimport timeGridPlugin from '@fullcalendar\/timegrid';\nimport interactionPlugin from '@fullcalendar\/interaction';/,
  `import dynamic from 'next/dynamic';\n\n// FullCalendarを動的インポート（SSR回避のため）\nconst FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false });\nconst dayGridPlugin = dynamic(() => import('@fullcalendar/daygrid').then(mod => mod.default || mod), { ssr: false });\nconst timeGridPlugin = dynamic(() => import('@fullcalendar/timegrid').then(mod => mod.default || mod), { ssr: false });\nconst interactionPlugin = dynamic(() => import('@fullcalendar/interaction').then(mod => mod.default || mod), { ssr: false });`
);

// plugin配列の部分は、動的インポートではなく通常のインポートをラッピングする方が良い。
// next/dynamic で plugin を読み込むのは FullCalendar の仕様に合わない。
