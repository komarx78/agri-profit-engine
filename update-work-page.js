const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/work/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. tasksステートの追加
content = content.replace(
  /const \[activeTab, setActiveTab\] = useState\('attendance'\);/,
  "const [activeTab, setActiveTab] = useState('attendance');\n  const [tasks, setTasks] = useState<any[]>([]);"
);

// 2. fetchDataでのタスク取得
// supabase.from('workers').select('*').eq('id', currentUser.id).single() を探す
// 取得した workerProfile.department_id を使ってタスクを絞り込む必要があるが、fetchData 内ではまだセット前かもしれない。
// ログインユーザーの tenantId と currentUser.id は使える。
const fetchStr = `          supabase.from('workers').select('*').eq('id', currentUser.id).single()
        ]);`;

const tasksQuery = `
          // tasks取得
          let dId = null;
          if (wRes.data && wRes.data.department_id) dId = wRes.data.department_id;
          
          const { data: tData } = await supabase.from('work_logs')
            .select('id, task_title, departments(name), crops(name), fields(name)')
            .eq('tenant_id', currentUser.tenant_id)
            .eq('status', 'planned')
            .eq('work_date', getJSTDate());
          
          if (tData) {
            // 全体、自分の部署、自分個人のいずれかに宛てられたタスクをフィルタ
            const myTasks = tData.filter((t:any) => 
              (!t.department_id && !t.worker_id) || 
              (t.department_id === dId) || 
              (t.worker_id === currentUser.id)
            );
            setTasks(myTasks);
          }
`;

content = content.replace(fetchStr, fetchStr + tasksQuery);


// 3. 作業タブの一番上にタスク一覧を表示
const tasksHtml = `
            {tasks.length > 0 && (
              <div className="bg-emerald-950/80 p-4 rounded-2xl border border-emerald-500/30 mb-6 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <h3 className="text-sm font-black text-emerald-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> 本日の指示・タスク ({tasks.length})
                </h3>
                <div className="space-y-2">
                  {tasks.map(t => (
                    <div key={t.id} className="bg-emerald-900/40 border border-emerald-800/50 p-3 rounded-xl flex flex-col gap-1.5">
                      <div className="text-white font-bold text-sm flex items-center gap-2">
                        {t.task_title}
                      </div>
                      <div className="flex gap-3 text-xs font-medium text-emerald-300/80">
                        {t.crops && <span>🌱 {t.crops.name}</span>}
                        {t.fields && <span>📍 {t.fields.name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
`;

content = content.replace(
  /<div className=\{\`flex bg-emerald-950\/80 p-1 rounded-xl mb-4 border border-emerald-800\`\}>/,
  tasksHtml + "\n            <div className={`flex bg-emerald-950/80 p-1 rounded-xl mb-4 border border-emerald-800`}>"
);


// 4. INSERT時の approval_status: 'pending' 追加
// タイマー完了時
content = content.replace(
  /status: 'completed',?\s*tenant_id: currentUser\.tenant_id,/g,
  "status: 'completed', approval_status: 'pending', tenant_id: currentUser.tenant_id,"
);
// 手動記録時
content = content.replace(
  /status: 'completed'\s*\}\]\)/g,
  "status: 'completed', approval_status: 'pending' }])"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated work page');
