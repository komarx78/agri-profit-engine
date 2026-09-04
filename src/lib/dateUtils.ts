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

