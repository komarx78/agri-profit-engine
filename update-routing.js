const fs = require('fs');
const path = require('path');

// 1. loginページの修正
const loginPath = path.join(__dirname, 'src/app/login/page.tsx');
let loginContent = fs.readFileSync(loginPath, 'utf8');
loginContent = loginContent.replace(
  /router\.push\('\/admin\/dashboard'\);/g,
  "router.push('/portal');"
);
fs.writeFileSync(loginPath, loginContent, 'utf8');
console.log('Successfully updated login redirect to /portal');

// 2. adminルートのリダイレクト修正
const adminPath = path.join(__dirname, 'src/app/admin/page.tsx');
if (fs.existsSync(adminPath)) {
  let adminContent = fs.readFileSync(adminPath, 'utf8');
  adminContent = adminContent.replace(
    /redirect\('\/admin\/dashboard'\)/g,
    "redirect('/portal')"
  );
  fs.writeFileSync(adminPath, adminContent, 'utf8');
  console.log('Successfully updated admin root redirect to /portal');
}
