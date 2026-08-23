const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("alert") && !lines[i].includes("Error") && !lines[i].includes("Geolocation")) {
    lines[i] = "      alert('Error occurred');";
  }
}

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
