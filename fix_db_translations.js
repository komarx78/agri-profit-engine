const https = require('https');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const SUPABASE_URL = 'https://xqneyssirhwedoemfzph.supabase.co';
const SUPABASE_KEY = 'sb_secret_5agNKIDijdNTl3nyMU6LYQ_0RhInbnw';

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
          resolve('');
        }
      });
    });
    req.on('error', (e) => resolve(''));
  });
}

async function fetchTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  return res.json();
}

async function updateRow(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Error updating ${table} ${id}:`, text);
  }
}

async function run() {
  const tables = ['crops', 'fields', 'materials', 'workers'];
  
  for (const table of tables) {
    console.log(`Processing table: ${table}...`);
    const rows = await fetchTable(table);
    if (!rows || rows.length === 0) continue;
    
    for (const row of rows) {
      if (!row.name) continue;
      
      let updated = false;
      let dataToUpdate = {};
      
      if (!row.name_si) {
        console.log(`Translating ${row.name} to Sinhala...`);
        dataToUpdate.name_si = await translate(row.name, 'si');
        updated = true;
      }
      if (!row.name_km) {
        console.log(`Translating ${row.name} to Khmer...`);
        dataToUpdate.name_km = await translate(row.name, 'km');
        updated = true;
      }
      
      if (updated) {
        await updateRow(table, row.id, dataToUpdate);
        console.log(`Updated ${row.name} in ${table}`);
      }
    }
  }
  console.log('All done!');
}

run();
