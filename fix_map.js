const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");

// replace select( id,
content = content.replace(/\.select\(\n\s*id,/g, ".select(\`\n          id,");
content = content.replace(/color\n\s*\)\n\s*\.order\('name'\);/g, "color\n        \`)\n        .order('name');");

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
