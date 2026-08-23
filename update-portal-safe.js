const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /import \{ t, LANGUAGES, LanguageCode \} from '@\/lib\/i18n';/,
  "import { t, LANGUAGES, LanguageCode } from '@/lib/i18n';\nimport { WorkerGate } from '@/components/WorkerGate';"
);

code = code.replace(
  /const \[attendance, setAttendance\] = useState<any>\(null\);/,
  "const [attendance, setAttendance] = useState<any>(null);\n  const [showWorkerGate, setShowWorkerGate] = useState(false);"
);

const targetUseEffect = `  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        let currentRole = 'worker';
        let profile = null;

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
        } else {
          const { data: workerData } = await supabase.from('workers').select('*').eq('user_id', session.user.id).single();
          if (workerData) {
            currentRole = 'worker';
            setRole('worker');
            profile = workerData;
            setWorkerProfile(workerData);
          }
        }
        
        setCurrentUser(session.user);
        await fetchPortalData(session.user.id, currentRole, profile);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [router]);`;

const replacementUseEffect = `  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        let currentRole = 'worker';
        let profile = null;
        let ownerId = '';

        if (session) {
          ownerId = session.user.id;
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
          } else {
            const { data: workerData } = await supabase.from('workers').select('*').eq('user_id', session.user.id).single();
            if (workerData) {
              currentRole = 'worker';
              setRole('worker');
              profile = workerData;
              setWorkerProfile(workerData);
              setCurrentUser(workerData);
            }
          }
        } else {
          const savedUser = localStorage.getItem('agri_current_worker');
          if (savedUser) {
            const workerData = JSON.parse(savedUser);
            currentRole = 'worker';
            setRole('worker');
            profile = workerData;
            setWorkerProfile(workerData);
            setCurrentUser(workerData);
            ownerId = workerData.user_id; 
            
            const { data: companyData } = await supabase.from('company_settings').select('company_name').limit(1).maybeSingle();
            if (companyData && companyData.company_name) {
              setCompanyName(companyData.company_name);
            } else {
              setCompanyName('Cocotte');
            }
          } else {
            setShowWorkerGate(true);
            setIsLoading(false);
            return;
          }
        }
        
        await fetchPortalData(ownerId, currentRole, profile);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [router]);`;

code = code.replace(targetUseEffect, replacementUseEffect);

const targetLogout = `  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };`;

const replacementLogout = `  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('agri_current_worker');
    setCurrentUser(null);
    setWorkerProfile(null);
    setRole('worker');
    setShowWorkerGate(true);
  };`;

code = code.replace(targetLogout, replacementLogout);

const targetIsLoading = `  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>;
  }`;

const replacementIsLoading = `  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>;
  }

  if (showWorkerGate) {
    return (
      <WorkerGate 
        onLogin={(user) => {
          setShowWorkerGate(false);
          window.location.reload();
        }} 
      />
    );
  }`;

code = code.replace(targetIsLoading, replacementIsLoading);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Safe update complete.');
