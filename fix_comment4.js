const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
content = content.replace(/([^\n])\s+try \{/g, "$1\n  try {");
content = content.replace(/([^\n])\s+const \{ data: worksData \}/g, "$1\n      const { data: worksData }");
content = content.replace(/([^\n])\s+if \(f\.path/g, "$1\n                  if (f.path");
fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
