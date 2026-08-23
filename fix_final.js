const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");

// íœŠÖ”éŒ¾‚Ì•œŠˆ
content = content.replace(
"  // æ—¢å­˜ãEç•‘ã‚’å‰Šé™¤ã™ã‚‹\n  try {",
"  // Šù‘¶‚Ì”¨‚ğíœ‚·‚é\n  const handleDeleteField = async (fieldId: number) => {\n  try {"
);

// 336s–Ú‚ ‚½‚è‚Ì•¶š‰»‚¯alert‚ÌC³
content = content.replace(/alert\('å‰Šé™¤ã—ã¾ã—ãŸã€E\);/g, "alert('íœ‚µ‚Ü‚µ‚½');");
content = content.replace(/alert\('å‰Šé™¤ã«å¤±æ•—ã—ã¾ã—ãŸ'\);/g, "alert('íœ‚É¸”s‚µ‚Ü‚µ‚½');");

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
