const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/masters/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 部署カードを探して、gridの中に戻す
// まず部署カードのHTMLを抽出・削除する
const startIdx = content.indexOf('{/* 部署 */}');
if (startIdx !== -1) {
  // 部署カードの終わりを探す。CSVアクションボタンのdivの閉じタグを探す
  const endMarker = '<CsvActionButtons type="departments" inputRef={null} />\n                </div>\n              </div>';
  const endIdx = content.indexOf(endMarker, startIdx);
  if (endIdx !== -1) {
    const cardHtml = content.substring(startIdx, endIdx + endMarker.length);
    // 削除
    content = content.substring(0, startIdx) + content.substring(endIdx + endMarker.length);
    
    // workersカードの閉じタグの直前（gridの閉じタグの前）に挿入する
    const workersEndMarker = '<CsvActionButtons type="workers" inputRef={fileInputRefWorkers} />\n                </div>\n              </div>';
    const workersEndIdx = content.indexOf(workersEndMarker);
    if (workersEndIdx !== -1) {
      content = content.substring(0, workersEndIdx + workersEndMarker.length) + '\n' + cardHtml + content.substring(workersEndIdx + workersEndMarker.length);
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed departments card layout');
