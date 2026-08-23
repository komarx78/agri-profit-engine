const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
content = content.replace("めE      const { data", "めE\n      const { data");
content = content.replace("付丁E      const mappedFields", "付丁E\n      const mappedFields");
content = content.replace("再取征E    } catch (err)", "再取征E\n    } catch (err)");
content = content.replace("形を保存すめE  const handleUpdatePolygon", "形を保存すめE\n  const handleUpdatePolygon");
content = content.replace("再取征E      fetchFieldsData();", "再取征E\n      fetchFieldsData();");
content = content.replace("形を修正\n                </div>", "形を修正\n                </div>\n");

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
