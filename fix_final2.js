const fs = require("fs");
let lines = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8").split("\n");

lines[326] = "  // 既存の畑を削除する";
lines[327] = "  const handleDeleteField = async (fieldId: number, fieldName: string) => {";
lines[328] = "    if (!confirm(`本当に「${fieldName}」を削除してもよろしいですか？\\nこの操作は取り消せません。`)) return;";
lines[329] = "    try {";
lines[330] = "      const { error } = await supabase";
lines[331] = "        .from('fields')";
lines[332] = "        .delete()";
lines[333] = "        .eq('id', fieldId);";
lines[334] = "";
lines[335] = "      if (error) throw error;";
lines[336] = "";
lines[337] = "      alert('削除しました。');";
lines[338] = "      setSelectedField(null);";
lines[339] = "      setInfoWindowPos(null);";
lines[340] = "      fetchFieldsData();";
lines[341] = "    } catch (err) {";
lines[342] = "      console.error(err);";
lines[343] = "      alert('削除に失敗しました。');";
lines[344] = "    }";
lines[345] = "  };";

// もう一つエラーになっていたかも？
// lines.spliceで前に何か消しているせいで行がずれているかもしれないので、
// 行で検索して置き換える。

let content = fs.readFileSync("src/app/admin/map/page.tsx", "utf-8");
content = content.replace(/\/\/ 譌｢蟄倥・逡代ｒ蜑企勁縺吶ｋ\n\s*try \{\n\s*const \{ error \} = await supabase/g, "  const handleDeleteField = async (fieldId: number, fieldName: string) => {\n    if (!confirm(`本当に「${fieldName}」を削除してもよろしいですか？\\nこの操作は取り消せません。`)) return;\n    try {\n      const { error } = await supabase");
content = content.replace(/alert\('蜑企勁縺励∪縺励◆縲・\);/g, "alert('削除しました');");

fs.writeFileSync("src/app/admin/map/page.tsx", content, "utf-8");
console.log("done");
