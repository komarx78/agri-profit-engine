const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
content = content.replace(/([^\n])\s+const handleMapClick/g, "$1\n  const handleMapClick");
content = content.replace(/([^\n])\s+const handleMapIdle/g, "$1\n  const handleMapIdle");
fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
