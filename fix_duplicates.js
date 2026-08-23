const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

// 105s–Ú‚ ‚½‚è‚Ì•¶š‰»‚¯alert‚ğíœ
lines = lines.filter(line => !line.includes("alert(`ä½æ‰€"));
// confirm‚ ‚½‚è‚Ì•¶š‰»‚¯‚ğíœ
lines = lines.filter(line => !line.includes("if (!confirm(`æœ¬å½“ã«ã€E{fieldName}"));

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
