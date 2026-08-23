const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
content = content.replace(/statusText: f\.id % 2 === 0 \? .* : .*/g, "statusText: f.id % 2 === 0 ? '生育中（キャベツ）' : '収穫待ち'");
fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
