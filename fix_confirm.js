const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

// 文字化けした confirm を削除
const badIdx = lines.findIndex(line => line.includes("if (!confirm(`譛ｬ蠖薙↓縲・{fieldName}"));
if (badIdx !== -1) {
  lines.splice(badIdx, 1);
  console.log("Deleted at " + badIdx);
} else {
  // もしインデックスでマッチしなければ総当りで探す
  const badIdx2 = lines.findIndex(line => line.includes("confirm") && line.includes("fieldName") && line.includes("譛ｬ"));
  if (badIdx2 !== -1) {
    lines.splice(badIdx2, 1);
    console.log("Deleted at " + badIdx2);
  }
}

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
