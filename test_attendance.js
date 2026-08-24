process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');

const envContent = fs.readFileSync('c:\\Users\\koma\\OneDrive - 株式会社cocotte\\GAS職人\\農業システム\\agri-profit-engine\\.env.local', 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function checkAttendanceErrors() {
  const url = `${supabaseUrl}/rest/v1/attendance_logs?select=id,worker_id,date,clock_in,clock_out&order=date.desc&limit=30`;

  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const logs = await res.json();
    console.log('最新の attendance_logs レコード:', logs);

    // 退勤忘れの判定
    const todayStr = new Date().toISOString().split('T')[0];
    const errorLogs = logs.filter(l => {
      // 出勤があるが退勤がない
      const hasClockIn = Boolean(l.clock_in);
      const noClockOut = !l.clock_out || l.clock_out === '-';
      return hasClockIn && noClockOut;
    });

    console.log(`\n🚨 退勤忘れ・打刻エラー検出件数: ${errorLogs.length} 件`);
    errorLogs.forEach((err, idx) => {
      console.log(`[エラー #${idx + 1}] ID: ${err.id}, Worker: ${err.worker_id}, Date: ${err.date}, In: ${err.clock_in}, Out: ${err.clock_out}`);
    });

  } catch (e) {
    console.error('Fetch error:', e);
  }
}

checkAttendanceErrors();
