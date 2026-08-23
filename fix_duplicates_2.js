const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

// 105行目を削除
if (lines[105].includes("alert") && lines[105].includes("REQUEST_DENIED")) {
  lines.splice(105, 1);
}

// 削除したことで行番号がずれるので、再度検索して confirm の文字化けも削除する
const confirmIdx = lines.findIndex(line => line.includes("if (!confirm") && line.includes("return;") && !line.includes("本当に"));
if (confirmIdx !== -1) {
  lines.splice(confirmIdx, 1);
}

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
