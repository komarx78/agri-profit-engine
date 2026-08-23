const fs = require("fs");
let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");

content = content.replace(
"  // 譌｢蟄倥・逡代ｒ蜑企勁縺吶ｋ\n    if (!confirm(`譛ｬ蠖薙↓縲・{fieldName}縲阪ｒ蜑企勁縺励※繧ゅｈ繧阪＠縺・〒縺吶°・歃n縺薙・謫堺ｽ懊・蜿悶ｊ豸医○縺ｾ縺帙ｓ縲Ａ)) return;",
"  // 既存の畑を削除する\n  const handleDeleteField = async (fieldId: number, fieldName: string) => {\n    if (!confirm(`本当に「${fieldName}」を削除してもよろしいですか？\\nこの操作は取り消せません。`)) return;"
);

// 閉じカッコの追加
content = content.replace(
"        fetchFieldsData(); // 蜀榊叙蠕・    } catch (err) {\n      console.error(err);\n      alert('蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆');\n    }\n  };\n",
"        fetchFieldsData();\n    } catch (err) {\n      console.error(err);\n      alert('削除に失敗しました');\n    }\n  };\n"
);

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
