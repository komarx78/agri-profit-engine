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
lines[336] = "      alert('削除しました。');";
lines[337] = "      setSelectedField(null);";
lines[338] = "      setInfoWindowPos(null);";
lines[339] = "      fetchFieldsData();";
lines[340] = "    } catch (err) {";
lines[341] = "      console.error(err);";
lines[342] = "      alert('削除に失敗しました。');";
lines[343] = "    }";
lines[344] = "  };";

fs.writeFileSync("src/app/admin/map/page.tsx", lines.join("\n"), "utf-8");
console.log("done");
