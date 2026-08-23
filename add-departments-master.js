const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/masters/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. MasterType
content = content.replace(
  /type MasterType = 'materials' \| 'sales_prices' \| 'crops' \| 'fields' \| 'workers';/,
  "type MasterType = 'materials' | 'sales_prices' | 'crops' | 'fields' | 'workers' | 'departments';"
);

// 2. State
content = content.replace(
  /const \[workers, setWorkers\] = useState<any\[\]>\(\[\]\);/,
  "const [workers, setWorkers] = useState<any[]>([]);\n  const [departments, setDepartments] = useState<any[]>([]);"
);

// 3. fetchMasters (Promise.all と setDepartments)
content = content.replace(
  /const \[cRes, fRes, wRes, mRes, spRes, csRes, chRes\] = await Promise\.all\(\[/,
  "const [cRes, fRes, wRes, mRes, spRes, csRes, chRes, dRes] = await Promise.all(["
);
content = content.replace(
  /supabase\.from\('sales_channels'\)\.select\('\*'\)\.order\('name'\)\n\s*\]\);/,
  "supabase.from('sales_channels').select('*').order('name'),\n        supabase.from('departments').select('*').order('name')\n      ]);"
);
content = content.replace(
  /setWorkers\(wRes\.data \|\| \[\]\);/,
  "setWorkers(wRes.data || []);\n      setDepartments(dRes.data || []);"
);

// 4. handleSave の insert/update に departments と workerへのdepartment_id 追加
// まず workers の insertData に department_id を追加 (add-role で置換済みなのでそれを探す)
content = content.replace(
  /insertData = \{ tenant_id: tenantId, name: formData\.name, hourly_wage: formData\.hourly_wage \|\| 1000, pin_code: formData\.pin_code \|\| '0000', role: formData\.role \|\| 'worker' \};/g,
  `insertData = { tenant_id: tenantId, name: formData.name, hourly_wage: formData.hourly_wage || 1000, pin_code: formData.pin_code || '0000', role: formData.role || 'worker', department_id: formData.department_id || null };`
);
content = content.replace(
  /updateData = \{ name: formData\.name, hourly_wage: formData\.hourly_wage \|\| 1000, pin_code: formData\.pin_code \|\| '0000', role: formData\.role \|\| 'worker' \};/g,
  `updateData = { name: formData.name, hourly_wage: formData.hourly_wage || 1000, pin_code: formData.pin_code || '0000', role: formData.role || 'worker', department_id: formData.department_id || null };`
);

// departments の insertData / updateData の追加
// } else if (type === 'workers') { ... } の後ろに追加する
content = content.replace(
  /(} else if \(type === 'workers'\) \{\s*insertData = \{[^}]+\};\s*})/g,
  `$1 else if (type === 'departments') {\n            insertData = { tenant_id: tenantId, name: formData.name };\n          }`
);
content = content.replace(
  /(} else if \(type === 'workers'\) \{\s*updateData = \{[^}]+\};\s*})/g,
  `$1 else if (type === 'departments') {\n            updateData = { name: formData.name };\n          }`
);

// 5. JSXに departments カードを追加。
// <CardHeader icon={User} title={`作業者 (${workers.length})`} type="workers" /> の部分を探す
// まずアイコンインポートを追加
content = content.replace(
  /ListTree, AlignLeft, Coffee } from 'lucide-react';/,
  "ListTree, AlignLeft, Coffee, Briefcase } from 'lucide-react';"
);

const departmentsCardHtml = `
              {/* 部署 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[400px]">
                <CardHeader icon={Briefcase} title={\`部署 (\${departments.length})\`} type="departments" />
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {departments.length === 0 ? <p className="text-slate-400 text-sm p-2">データなし</p> : null}
                  {departments.map(d => (
                    <div key={d.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center group hover:border-emerald-200 transition-colors">
                      <div className="font-bold text-slate-700">{d.name}</div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal('departments', d)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete('departments', d.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
`;

content = content.replace(
  /(<CardHeader icon=\{User\} title=\{`作業者 \(\$\{workers\.length\}\)`\} type="workers" \/>\s*<div className="flex-1 overflow-y-auto p-2 space-y-2">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/,
  `$1\n${departmentsCardHtml}`
);
// 置換がうまくいかないかもしれないので、<div className="mb-16">の前に追加するなどのアプローチも用意しておく。
// CardHeader のブロックを探す
content = content.replace(
  /(<CardHeader icon=\{User\} title=\{`作業者 \(\$\{workers\.length\}\)`\} type="workers" \/>\s*<div className="flex-1 overflow-y-auto p-2 space-y-2">[\s\S]*?<\/div>\s*<div className="p-4 bg-slate-50 border-t border-slate-100">[\s\S]*?<\/div>\s*<\/div>)/,
  `$1\n${departmentsCardHtml}`
);


// 6. workersモーダルにdepartment_idを追加、departmentsモーダルを追加
const departmentsModalHtml = `
              {modalType === 'departments' && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 mb-1">部署名 <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="例: 栽培部"
                  />
                </div>
              )}
`;

const workerDeptHtml = `
                    <div className="col-span-2 mt-4">
                      <label className="block text-xs font-bold text-slate-500 mb-1">所属部署</label>
                      <select
                        value={formData.department_id || ''}
                        onChange={e => setFormData({...formData, department_id: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-slate-700"
                      >
                        <option value="">未所属</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
`;

// modalType === 'workers' のJSXを見つけて追加
content = content.replace(
  /(<option value="admin">管理者 \(admin\)<\/option>\s*<\/select>\s*<\/div>)/,
  `$1\n${workerDeptHtml}`
);

// modalType のどれにも一致しない場合用
content = content.replace(
  /(\{modalType === 'workers' && \([\s\S]*?<\/select>\s*<\/div>\s*<\/div>\s*<\/>\s*\)\})/,
  `$1\n${departmentsModalHtml}`
);


fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated masters page for departments and tasks');
