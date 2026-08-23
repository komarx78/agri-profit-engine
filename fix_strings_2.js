const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");

content = content.replace(/alert\("逡代ｒ菴懊ｋ縺ｫ縺ｯ譛?菴・縺区園縺ｮ鬆らせ繧偵け繝ｪ繝・け縺励※縺上□縺輔＞縲・\);/g, 'alert("畑を作るには最低3か所の頂点をクリックしてください。");');
content = content.replace(/alert\("繧ｨ繝ｩ繝ｼ: 蝨ｰ蝗ｳ繝・・繧ｿ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆縲・\);/g, 'alert("エラー: 地図データの取得に失敗しました。");');
content = content.replace(/alert\('蜷榊燕縺ｮ菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆縲・\);/g, "alert('名前の保存に失敗しました。');");
content = content.replace(/alert\('菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆縲・\);/g, "alert('保存に失敗しました。');");

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
