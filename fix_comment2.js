const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
content = content.replace(/([^\n])\s+const \{ data: fieldsData, error \} = await supabase/g, "$1\n      const { data: fieldsData, error } = await supabase");
content = content.replace(/([^\n])\s+const mappedFields/g, "$1\n      const mappedFields");
content = content.replace(/([^\n])\s+} catch \(err\)/g, "$1\n    } catch (err)");
content = content.replace(/([^\n])\s+const handleUpdatePolygon/g, "$1\n  const handleUpdatePolygon");
content = content.replace(/([^\n])\s+fetchFieldsData\(\);/g, "$1\n      fetchFieldsData();");
fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
