const fs = require('fs');
const path = require('path');

// 1. portal/page.tsx の会社名を company_settings から取得するように修正
const portalPath = path.join(__dirname, 'src/app/portal/page.tsx');
let portalContent = fs.readFileSync(portalPath, 'utf8');

portalContent = portalContent.replace(
  /const \{ data: userData \} = await supabase\.from\('users'\)\.select\('\*'\)\.eq\('id', session\.user\.id\)\.single\(\);/,
  "const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();\n    const { data: companyData } = await supabase.from('company_settings').select('company_name').limit(1).single();"
);

portalContent = portalContent.replace(
  /if \(userData\) setCompanyName\(userData\.company_name \|\| userData\.farm_name \|\| userData\.name \|\| 'Cocotte'\);/,
  "if (companyData && companyData.company_name) {\n      setCompanyName(companyData.company_name);\n    } else if (userData && userData.name) {\n      setCompanyName(userData.name);\n    } else {\n      setCompanyName('Cocotte');\n    }"
);
fs.writeFileSync(portalPath, portalContent, 'utf8');

// 2. api/translate/route.ts のモデル名をgemini-1.5-flashに修正
const translatePath = path.join(__dirname, 'src/app/api/translate/route.ts');
let translateContent = fs.readFileSync(translatePath, 'utf8');
translateContent = translateContent.replace(/gemini-3\.5-flash/g, "gemini-1.5-flash");
fs.writeFileSync(translatePath, translateContent, 'utf8');

console.log('Fixed company name and Gemini model version');
