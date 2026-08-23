const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

lines[104] = "        alert(`住所が見つかりませんでした。\\nエラー詳細: ${status}\\n※REQUEST_DENIED と出る場合は、Google Cloud側で Geocoding API に制限がかかっている可能性があります。`);";
lines[319] = "    if (!confirm(`本当に「${fieldName}」を削除してもよろしいですか？\\nこの操作は取り消せません。`)) return;";

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
