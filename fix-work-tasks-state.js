const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/work/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// tasks state を追加する
const targetStr = `const [activeTab, setActiveTab] = useState<'attendance' | 'work' | 'board'>('attendance');`;
if (!content.includes('const [tasks, setTasks] = useState<any[]>([]);')) {
  content = content.replace(
    targetStr,
    targetStr + "\n  const [tasks, setTasks] = useState<any[]>([]);"
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added tasks state to work page');
