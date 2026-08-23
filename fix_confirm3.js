const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("confirm") && lines[i].includes("fieldName")) {
    if (!lines[i].includes("–{“–‚É")) {
      console.log("Found corrupted confirm at " + i + ": " + lines[i]);
      lines.splice(i, 1);
      console.log("Deleted!");
      break;
    }
  }
}

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
