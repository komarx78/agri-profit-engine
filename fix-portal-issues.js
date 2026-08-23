const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/portal/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. 名前変更
content = content.replace(/Cocotte Portal/g, '会社名 Portal');

// 2. 打刻エラー修正 (workerId の取得を安全にする)
// 管理者でも worker として登録されていれば workerProfile.id がある。
// なければ「エラー: 現場スタッフとして登録されていません」とするか、
// user_id を使わないようにする。
const clockLogic = `
  const handleClockAction = async (type: 'in' | 'out') => {
    if (!currentUser) return;
    const today = getJSTDate();
    const time = getJSTTime();
    
    // workerProfile.id (UUID of workers table) が必須
    if (!workerProfile || !workerProfile.id) {
      alert('打刻エラー: あなたのアカウントは現場スタッフとして「スタッフマスタ」に登録されていません。\\n管理者画面からご自身をスタッフ登録してください。');
      return;
    }
    const workerId = workerProfile.id;

    try {
      if (type === 'in') {
        const { data, error } = await supabase.from('attendance_logs').insert([{
          worker_id: workerId,
          date: today,
          clock_in: time,
          status: 'working'
        }]).select().single();
        if (error) throw error;
        setAttendance(data);
      } else {
        if (!attendance) return;
        const { data, error } = await supabase.from('attendance_logs').update({
          clock_out: time,
          status: 'left'
        }).eq('id', attendance.id).select().single();
        if (error) throw error;
        setAttendance(data);
      }
    } catch (err) {
      console.error('打刻エラー:', err);
      alert('打刻に失敗しました。');
    }
  };
`;
content = content.replace(/const handleClockAction = async \([\s\S]*?alert\('打刻に失敗しました。'\);\n    \}\n  \};/, clockLogic.trim());

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated portal page: Name and Clock logic');
