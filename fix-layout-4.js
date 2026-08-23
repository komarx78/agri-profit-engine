const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/masters/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 万が一、cardHtmlが残っていたら消す
const startIdx = content.indexOf('{/* 部署 */}');
if (startIdx !== -1) {
  const endMarker = '<CsvActionButtons type="departments" inputRef={null} />\n                </div>\n              </div>';
  const endIdx = content.indexOf(endMarker, startIdx);
  if (endIdx !== -1) {
    content = content.substring(0, startIdx) + content.substring(endIdx + endMarker.length);
  }
}

// デザインを既存のものと完全に合わせる
const departmentsCardHtml = `
            {/* 部署 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[420px]">
              <CardHeader icon={Briefcase} title={\`部署 (\${departments.length})\`} type="departments" />
              <div className="space-y-2 overflow-y-auto flex-1 mb-4 pr-1">
                {departments.length === 0 ? <p className="text-slate-400 text-sm">データなし</p> : null}
                {departments.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 flex justify-between items-center group transition-colors">
                    <span className="font-bold text-slate-700">{d.name}</span>
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
              <CsvActionButtons type="departments" inputRef={null} />
            </div>`;

// workersカードの終了位置を正確に見つける
const workersMarker = `type="workers" inputRef={fileInputRefWorkers} />\n            </div>`;
let insertPos = content.indexOf(workersMarker);

if (insertPos !== -1) {
  content = content.substring(0, insertPos + workersMarker.length) + '\n' + departmentsCardHtml + content.substring(insertPos + workersMarker.length);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully re-inserted departments card (v4 - final)');
