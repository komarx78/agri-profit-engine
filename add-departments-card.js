const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/masters/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

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
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <CsvActionButtons type="departments" inputRef={null} />
                </div>
              </div>
`;

// workerのカードの次に追加する。
const targetStr = `              <CsvActionButtons type="workers" inputRef={fileInputRefWorkers} />
            </div>
          </div>`;

content = content.replace(targetStr, targetStr + "\n" + departmentsCardHtml);

// handleSave の中
// } else if (type === 'departments') {
if (!content.includes("else if (type === 'departments') {")) {
  content = content.replace(
    /(} else if \(type === 'workers'\) \{\s*insertData = \{[^}]+\};\s*})/,
    `$1 else if (type === 'departments') {\n            insertData = { tenant_id: tenantId, name: formData.name };\n          }`
  );
  content = content.replace(
    /(} else if \(type === 'workers'\) \{\s*updateData = \{[^}]+\};\s*})/,
    `$1 else if (type === 'departments') {\n            updateData = { name: formData.name };\n          }`
  );
}

// モーダル
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
if (!content.includes("modalType === 'departments'")) {
  const targetModal = `{modalType === 'workers' && (`;
  content = content.replace(targetModal, departmentsModalHtml + "\n              " + targetModal);
}


fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully injected cards and modals');
