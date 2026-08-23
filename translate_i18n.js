const fs = require('fs');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const targetFile = path.join(__dirname, 'src', 'lib', 'i18n.ts');
let content = fs.readFileSync(targetFile, 'utf8');

// 簡単なパースとして正規表現を使うか、Astを使うか。
// TSファイルをASTでパースするのは面倒なので、正規表現で置換する。

const https = require('https');

async function translate(text, lang) {
  return new Promise((resolve, reject) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`;
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed[0][0][0]);
        } catch(e) {
          console.error('Parse error:', data);
          resolve('');
        }
      });
    });
    req.on('error', (e) => {
      console.error(e);
      resolve('');
    });
  });
}

async function run() {
  console.log('Translating missing languages...');
  const translationBlockRegex = /([a-zA-Z0-9_]+|'[^']+'):\s*\{\s*ja:\s*'([^']+)',([^}]+)\}/g;
  
  let newContent = content;
  let match;
  
  // 文字列の置換を非同期で行うため、一回全部抽出する
  const matches = [];
  while ((match = translationBlockRegex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      key: match[1],
      ja: match[2],
      rest: match[3]
    });
  }

  for (const m of matches) {
    if (!m.rest.includes('si:') || m.rest.includes("si: ''") || m.rest.includes("si: ''")) {
      console.log(`Translating: ${m.ja}`);
      const si = await translate(m.ja, 'si');
      const km = await translate(m.ja, 'km');
      
      // シングルクォートをエスケープ
      const safeSi = si.replace(/'/g, "\\'");
      const safeKm = km.replace(/'/g, "\\'");
      
      let newRest = m.rest;
      // 既存の空文字キーを置換
      newRest = newRest.replace(/,\s*si:\s*''/, '');
      newRest = newRest.replace(/,\s*km:\s*''/, '');
      
      if (!newRest.includes('si:')) newRest += `, si: '${safeSi}'`;
      if (!newRest.includes('km:')) newRest += `, km: '${safeKm}'`;
      
      const newFull = `${m.key}: { ja: '${m.ja}',${newRest} }`;
      newContent = newContent.replace(m.full, newFull);
      
      // 1秒待機（API制限回避）
      await new Promise(r => setTimeout(r, 500));
    }
  }

  fs.writeFileSync(targetFile, newContent, 'utf8');
  console.log('Translation complete!');
}

run();
