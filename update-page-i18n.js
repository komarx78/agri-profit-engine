const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/work/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// タブ
content = content.replace(
  /<MessageSquare className="w-4 h-4" \/>社内掲示板/g,
  `<MessageSquare className="w-4 h-4" />{t('board', language)}`
);

// フォームのプレースホルダー
content = content.replace(
  /placeholder="みんなに伝えたいこと（生活情報・業務報告など）を書きましょう！"/g,
  `placeholder={t('boardPostPlaceholder', language)}`
);

// フォームのセレクトボックス
content = content.replace(
  /<option value="life">🛒 生活情報<\/option>/g,
  `<option value="life">🛒 {t('boardFilterLife', language)}</option>`
);
content = content.replace(
  /<option value="work">🚜 業務報告<\/option>/g,
  `<option value="work">🚜 {t('boardFilterWork', language)}</option>`
);
content = content.replace(
  /<option value="general">💬 その他<\/option>/g,
  `<option value="general">💬 {t('boardFilterGeneral', language)}</option>`
);

// 送信ボタン
content = content.replace(
  /\{isSubmitting \? <Loader2 className="w-4 h-4 animate-spin" \/> : '送信'\}/g,
  `{isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('boardSend', language)}`
);

// フィルターUI
content = content.replace(
  />\s*すべて\s*<\/button>/g,
  `>{t('boardFilterAll', language)}</button>`
);
content = content.replace(
  />\s*🚜 業務報告\s*<\/button>/g,
  `>🚜 {t('boardFilterWork', language)}</button>`
);
content = content.replace(
  />\s*🛒 生活情報\s*<\/button>/g,
  `>🛒 {t('boardFilterLife', language)}</button>`
);
content = content.replace(
  />\s*💬 その他\s*<\/button>/g,
  `>💬 {t('boardFilterGeneral', language)}</button>`
);

// タイムラインのカテゴリー表示
content = content.replace(
  /\{post\.category === 'life' \? '🛒 生活情報' : post\.category === 'work' \? '🚜 業務報告' : '💬 その他'\}/g,
  `{post.category === 'life' ? \`🛒 \${t('boardFilterLife', language)}\` : post.category === 'work' ? \`🚜 \${t('boardFilterWork', language)}\` : \`💬 \${t('boardFilterGeneral', language)}\`}`
);

// 削除ボタン
content = content.replace(
  /<Trash2 className="w-3\.5 h-3\.5" \/> 削除/g,
  `<Trash2 className="w-3.5 h-3.5" /> {t('boardDelete', language)}`
);

// 投稿がありません
content = content.replace(
  /表示する投稿がありません/g,
  `{t('boardNoPosts', language)}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated page.tsx with translations');
