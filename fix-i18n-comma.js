const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/lib/i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

// board の前にカンマがない場合に追加する
content = content.replace(/}(\s*\/\/\s*掲示板関連\s*board:)/, '},$1');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed i18n.ts comma error');
