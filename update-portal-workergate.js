const fs = require('fs');
const path = require('path');

const portalPath = path.join(__dirname, 'src/app/portal/page.tsx');
let code = fs.readFileSync(portalPath, 'utf8');

// WorkerGate のインポート追加
if (!code.includes('import { WorkerGate }')) {
  code = code.replace(
    /import \{ t, LANGUAGES, LanguageCode \} from '@\/lib\/i18n';/,
    "import { t, LANGUAGES, LanguageCode } from '@/lib/i18n';\nimport { WorkerGate } from '@/components/WorkerGate';"
  );
}

// showWorkerGate の追加
if (!code.includes('showWorkerGate')) {
  code = code.replace(
    /const \[attendance, setAttendance\] = useState<any>\(null\);/,
    "const [attendance, setAttendance] = useState<any>(null);\n  const [showWorkerGate, setShowWorkerGate] = useState(false);"
  );
}

// useEffectを丸ごと置換する
const newUseEffect = `
  useEffect(() => {
    const init = async () => {
      try {
        let currentRole = 'worker';
        let profile = null;
        let userIdForFetch = null;

        // 1. まずAdminセッションを確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // --- 管理者(またはAuth登録されたユーザー)の場合 ---
          const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
          const { data: companyData } = await supabase.from('company_settings').select('company_name').limit(1).single();
          
          if (companyData && companyData.company_name) {
            setCompanyName(companyData.company_name);
          } else if (userData && userData.name) {
            setCompanyName(userData.name);
          } else {
            setCompanyName('Cocotte');
          }

          if (userData && userData.role === 'admin') {
            currentRole = 'admin';
            setRole('admin');
            setCurrentUser(userData);
            userIdForFetch = userData.id;
          } else {
            const { data: workerData } = await supabase.from('workers').select('*').eq('user_id', session.user.id).single();
            if (workerData) {
              currentRole = 'worker';
              setRole('worker');
              profile = workerData;
              setWorkerProfile(workerData);
              setCurrentUser(workerData);
              userIdForFetch = workerData.id;
            } else {
              // 権限なし
              router.push('/login');
              return;
            }
          }
        } else {
          // --- セッションがない場合はローカルストレージ（PINログイン履歴）を確認 ---
          const savedUser = localStorage.getItem('agri_current_worker');
          if (savedUser) {
            const workerData = JSON.parse(savedUser);
            currentRole = 'worker';
            setRole('worker');
            profile = workerData;
            setWorkerProfile(workerData);
            setCurrentUser(workerData);
            userIdForFetch = workerData.id;
            
            // 会社名は一旦デフォルト（WorkerGateには会社名取得がないため）
            // 必要に応じてDBから引くことも可能だが、今回は簡易的にハードコード
            setCompanyName('Cocotte');
          } else {
            // PINログインもしていなければ、WorkerGateを表示する
            setShowWorkerGate(true);
            setIsLoading(false);
            return;
          }
        }

        // --- データフェッチ ---
        // Tasks
        if (currentRole === 'admin') {
          const { data: tData } = await supabase.from('tasks').select('*').order('due_date', { ascending: true }).limit(5);
          if (tData) setTasks(tData);
        } else if (profile) {
          const { data: tData } = await supabase.from('tasks').select('*').or(\`assignee_id.eq.\${profile.id},assignee_id.is.null\`).order('due_date', { ascending: true }).limit(5);
          if (tData) setTasks(tData);
        }

        // Approvals (Admin only)
        if (currentRole === 'admin') {
          const { data: aData } = await supabase.from('hr_requests').select('*, workers(name)').eq('status', 'pending').limit(3);
          if (aData) setPendingApprovals(aData);
        }

        // Board Posts
        const { data: bData } = await supabase.from('board_posts').select('*, workers(name)').order('created_at', { ascending: false }).limit(5);
        if (bData) setBoardPosts(bData);

        // Attendance (Worker only)
        if (currentRole === 'worker' && profile) {
          const today = getJSTDate();
          const { data: attData } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('worker_id', profile.id)
            .eq('date', today)
            .single();
          if (attData) setAttendance(attData);
        }

      } catch (error) {
        console.error('Error fetching portal data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [router, showWorkerGate]); // showWorkerGateも依存配列に入れておく
`;

code = code.replace(/useEffect\(\(\) => \{\s*const init = async \(\) => \{[\s\S]*?init\(\);\s*\}, \[router\]\);/, newUseEffect.trim());

// WorkerGate のレンダリング追加
if (!code.includes('if (showWorkerGate)')) {
  code = code.replace(
    /if \(isLoading\) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-500"><Loader2 className="w-8 h-8 animate-spin" \/><\/div>;/,
    "if (isLoading) return <div className=\"min-h-screen bg-slate-50 flex items-center justify-center text-blue-500\"><Loader2 className=\"w-8 h-8 animate-spin\" /><\/div>;\n\n  if (showWorkerGate) {\n    return <WorkerGate onLogin={(user) => { setShowWorkerGate(false); }} />;\n  }"
  );
}

fs.writeFileSync(portalPath, code, 'utf8');
console.log('WorkerGate integration applied to portal page.');
