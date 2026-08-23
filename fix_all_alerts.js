const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("alert") && lines[i].includes("ã")) {
    console.log("Replacing at " + i + ": " + lines[i]);
    lines[i] = "      alert('ƒGƒ‰[‚ª”­¶‚µ‚Ü‚µ‚½');";
  }
}

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
