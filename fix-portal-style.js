const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const styleBlock = `      <style dangerouslySetInnerHTML={{__html: \`
        .fc-theme-standard .fc-button-primary {
          background-color: #3b82f6 !important;
          border-color: #2563eb !important;
        }
        .fc-theme-standard .fc-button-primary:hover {
          background-color: #2563eb !important;
        }
        .fc-theme-standard .fc-toolbar-title {
          font-size: 1.25rem !important;
          font-weight: 900 !important;
          color: #1e293b;
        }
      \`}} />`;

content = content.replace(/<style dangerouslySetInnerHTML[\s\S]*?\/>/, styleBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed portal style block');
