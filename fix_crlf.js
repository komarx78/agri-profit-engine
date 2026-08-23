const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");
content = content.replace(/\r/g, "\n");
fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
