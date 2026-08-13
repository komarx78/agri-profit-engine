const fs = require('fs');
const { v2 } = require('@google-cloud/translate');

const envContent = fs.readFileSync('.env.local', 'utf8');
const envs = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envs[match[1].trim()] = match[2].trim();
});

// process.env をモックする（@google-cloud/translate が内部で使うかもしれないため）
Object.assign(process.env, envs);

async function test() {
  try {
    const translate = new v2.Translate();
    const [translation] = await translate.translate('トマト', 'en');
    console.log('Success:', translation);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
