const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");

// "// コメント  コード" のようになっているものを全て直す
// 正規表現: // 任意の文字(改行以外) + スペース2つ以上 + (const|let|var|if|return|\}|\]|\)|\.)
content = content.replace(/(\/\/[^\n]*?) {2,}(const|let|var|if|return|\}|\]|\)|\.|\w+\()/g, "$1\n      $2");

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
