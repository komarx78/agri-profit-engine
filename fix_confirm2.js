const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("confirm") && lines[i].includes("fieldName")) {
    console.log("Found at " + i + ": " + lines[i]);
    if (lines[i].includes("本")) {
      lines.splice(i, 1);
      console.log("Deleted!");
      break;
    }
  }
}

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
