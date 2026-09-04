/**
 * 日本標準時 (JST: UTC+9) の安全な日付・時刻ユーティリティ
 * 早朝アクセスや端末のタイムゾーン設定（UTC等）に影響されず、
 * 常に正確な日本時間を返します。
 */

// YYYY-MM-DD 文字列を取得
export function getJSTDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date).replace(/\//g, '-');
}

// HH:mm 文字列を取得
export function getJSTTime(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

// 相対日数（今日、明日、+N日後）の JST 日付文字列とDateオブジェクトを取得
export function getJSTDateWithOffset(daysOffset: number, baseDate: Date = new Date()): { dateStr: string; dateObj: Date } {
  const jstStr = getJSTDate(baseDate);
  const [y, m, d] = jstStr.split('-').map(Number);
  const target = new Date(y, m - 1, d + daysOffset);
  return {
    dateStr: getJSTDate(target),
    dateObj: target
  };
}

// ISO文字列やHH:mmから "HH:mm" をJSTで安全に表示
export function formatDisplayTime(val: string | null | undefined): string {
  if (!val) return '';
  if (val.includes('T')) {
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    } catch (e) {
      return val;
    }
  }
  return val.substring(0, 5);
}

// ISO文字列や "HH:mm" 文字列から日本時間基準の一日の分数（0〜1439）を安全に算出
export function parseTimeToMinutes(val: string | null | undefined): number | null {
  if (!val) return null;
  if (val.includes('T')) {
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      // 日本時間での時間と分を取得
      const parts = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(d);
      
      const hourPart = parts.find(p => p.type === 'hour')?.value;
      const minPart = parts.find(p => p.type === 'minute')?.value;
      if (hourPart !== undefined && minPart !== undefined) {
        return Number(hourPart) * 60 + Number(minPart);
      }
    } catch (e) {
      return null;
    }
  }
  const clean = val.substring(0, 5);
  const parts = clean.split(':').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

/**
 * 勤怠締日（0=末日、20=20日、15=15日等）に基づき、
 * 指定された年月（例: 2026年9月度）の集計開始日と終了日を算出
 */
export function getAttendancePeriod(
  year: number,
  month: number, // 1〜12
  closingDay: number = 0
): { startDate: string; endDate: string; label: string } {
  const cleanClosingDay = Number(closingDay) || 0;

  if (cleanClosingDay === 0 || cleanClosingDay >= 29) {
    // 末日締め（当月1日〜当月末日）
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    return {
      startDate,
      endDate,
      label: `${year}/${monthStr}/01 〜 ${year}/${monthStr}/${String(lastDay).padStart(2, '0')} (末日締め)`
    };
  }

  // 1〜28日締め（例: 20日締めなら 前月21日 〜 当月20日）
  // 前月の年月を算出
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }

  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const targetMonthStr = String(month).padStart(2, '0');

  // 開始日: 前月の (締日 + 1) 日
  const startDayNum = cleanClosingDay + 1;
  const startDayStr = String(startDayNum).padStart(2, '0');
  const startDate = `${prevYear}-${prevMonthStr}-${startDayStr}`;

  // 終了日: 当月の 締日
  const endDayStr = String(cleanClosingDay).padStart(2, '0');
  const endDate = `${year}-${targetMonthStr}-${endDayStr}`;

  return {
    startDate,
    endDate,
    label: `${prevYear}/${prevMonthStr}/${startDayStr} 〜 ${year}/${targetMonthStr}/${endDayStr} (${cleanClosingDay}日締め)`
  };
}

/**
 * 開始日 (YYYY-MM-DD) から 終了日 (YYYY-MM-DD) までの連続した日付文字列の配列を返す
 */
export function getDateListBetween(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startDateStr];
  }

  let curr = new Date(start);
  while (curr <= end) {
    dates.push(getJSTDate(curr));
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}

