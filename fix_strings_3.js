const fs = require("fs");
const lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");
lines[240] = '      alert("畑を作るには最低3か所の頂点をクリックしてください。");';
lines[343] = "      alert('名前の保存に失敗しました。');";
lines[350] = '      alert("エラー: 地図データの取得に失敗しました。");';
lines[416] = "      alert('保存に失敗しました。');";
fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
