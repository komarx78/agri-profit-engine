const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/masters/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// roleの追加JSX
const roleHtml = `
                    <div className="col-span-2 mt-4">
                      <label className="block text-xs font-bold text-slate-500 mb-1">権限 (Role)</label>
                      <select
                        value={formData.role || 'worker'}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                      >
                        <option value="worker">一般スタッフ</option>
                        <option value="admin">管理者 (admin)</option>
                      </select>
                    </div>
`;

// workerモーダルのJSX部分を置換
// 既存の <div className="grid grid-cols-2 gap-4">...</div> の末尾に追加する
const targetSearchStr = `placeholder="0000"\n                      />\n                    </div>\n                  </div>`;
content = content.replace(targetSearchStr, targetSearchStr + roleHtml);

// DB挿入用データに role を含めるための処理を探す
// 元々のコード:
// } else if (type === 'workers') {
//   insertData = { tenant_id: tenantId, name: formData.name, hourly_wage: formData.hourly_wage || 1000, pin_code: formData.pin_code || '0000' };

content = content.replace(
  /insertData = \{ tenant_id: tenantId, name: formData\.name, hourly_wage: formData\.hourly_wage \|\| 1000, pin_code: formData\.pin_code \|\| '0000' \};/g,
  `insertData = { tenant_id: tenantId, name: formData.name, hourly_wage: formData.hourly_wage || 1000, pin_code: formData.pin_code || '0000', role: formData.role || 'worker' };`
);

content = content.replace(
  /updateData = \{ name: formData\.name, hourly_wage: formData\.hourly_wage \|\| 1000, pin_code: formData\.pin_code \|\| '0000' \};/g,
  `updateData = { name: formData.name, hourly_wage: formData.hourly_wage || 1000, pin_code: formData.pin_code || '0000', role: formData.role || 'worker' };`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added role field to workers modal');
