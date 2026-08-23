const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");
lines[369] = "      alert('–¼‘O‚Ì•Û‘¶‚É¸”s‚µ‚Ü‚µ‚½B');";
fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
