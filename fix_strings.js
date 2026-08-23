const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");

// Fix alert
const badAlert = "alert(`菴乗園縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆縲・n・医お繝ｩ繝ｼ隧ｳ邏ｰ: ${status}・噂n窶ｻREQUEST_DENIED 縺ｨ蜃ｺ繧句ｴ蜷医・縲；oogle Cloud蛛ｴ縺ｧ Geocoding API 縺ｫ蛻ｶ髯舌′縺九°縺｣縺ｦ縺・ｋ蜿ｯ閭ｽ諤ｧ縺後≠繧翫∪縺吶?Ａ);";
const goodAlert = 'alert(`住所が見つかりませんでした。\\nエラー詳細: ${status}\\n※REQUEST_DENIED と出る場合は、Google Cloud側で Geocoding API に制限がかかっている可能性があります。`);';
content = content.replace(badAlert, goodAlert);

// Fix confirm
const badConfirm = "if (!confirm(`譛ｬ蠖薙↓縲・{fieldName}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歃n縺薙・謫堺ｽ懊・蜿悶ｊ豸医○縺ｾ縺帙ｓ縲Ａ)) return;";
const goodConfirm = "if (!confirm(`本当に「${fieldName}」を削除してもよろしいですか？\\nこの操作は取り消せません。`)) return;";
content = content.replace(badConfirm, goodConfirm);

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
