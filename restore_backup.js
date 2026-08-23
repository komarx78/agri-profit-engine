const fs = require("fs");
let content = fs.readFileSync("backup_page.tsx", "utf-8");

// "\n\n\t\t\t\tThe command exited with code 0.\n\t\t\t\tStdout:\n\t\t\t\t" のようなヘッダーを取り除く
const headerMatch = content.match(/Stdout:\n\t\t\t\t([\s\S]+)$/);
if (headerMatch) {
  content = headerMatch[1];
}

// 最後に残る "\n\t\t\t\tStderr:\n\t\t\t\t\n" を取り除く
content = content.replace(/\n\t\t\t\tStderr:[\s\S]*$/, "");

// CRを取り除く
content = content.replace(/\r/g, "");

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
