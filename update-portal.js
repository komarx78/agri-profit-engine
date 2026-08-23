const fs = require('fs');
const path = require('path');

const portalPath = path.join(__dirname, 'src/app/portal/page.tsx');
let code = fs.readFileSync(portalPath, 'utf8');

// 1. WorkerGate のインポートを追加
if (!code.includes('WorkerGate')) {
  code = code.replace(
    /import \{ t, LANGUAGES, LanguageCode \} from '@\/lib\/i18n';/,
    "import { t, LANGUAGES, LanguageCode } from '@/lib/i18n';\nimport { WorkerGate } from '@/components/WorkerGate';"
  );
}

// 2. state の追加
if (!code.includes('showWorkerGate')) {
  code = code.replace(
    /const \[attendance, setAttendance\] = useState<any>\(null\);/,
    "const [attendance, setAttendance] = useState<any>(null);\n  const [showWorkerGate, setShowWorkerGate] = useState(false);"
  );
}

// 3. useEffect の中身をリファクタリングして、fetchPortalData 関数を分離する
// これはかなり複雑になるため、手動で直接ファイル全体を書き直す方が確実。
// なので、ここでスクリプトを生成する。
