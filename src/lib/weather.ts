/**
 * 圃場気象データ取得 & 積算計算 & 収穫適期予測モジュール
 * Open-Meteo API (完全無料・商用可・キー不要) を使用
 */

// 主要作物の標準目標積算温度マスタ（定植/播種〜収穫までの目安℃）
export const CROP_ACCUMULATED_TEMP_DEFAULTS: Record<string, { targetTemp: number; baseTemp: number; note: string }> = {
  'トマト': { targetTemp: 1000, baseTemp: 10, note: '定植〜収穫開始まで約900〜1100℃（開花後約50〜55日）' },
  'ミニトマト': { targetTemp: 850, baseTemp: 10, note: '定植〜収穫開始まで約800〜950℃' },
  'きゅうり': { targetTemp: 750, baseTemp: 12, note: '定植〜初期収穫まで約700〜800℃' },
  'キュウリ': { targetTemp: 750, baseTemp: 12, note: '定植〜初期収穫まで約700〜800℃' },
  'ナス': { targetTemp: 1100, baseTemp: 12, note: '定植〜収穫開始まで約1000〜1200℃' },
  'なす': { targetTemp: 1100, baseTemp: 12, note: '定植〜収穫開始まで約1000〜1200℃' },
  'ピーマン': { targetTemp: 1100, baseTemp: 12, note: '定植〜収穫開始まで約1000〜1200℃' },
  'パプリカ': { targetTemp: 1300, baseTemp: 12, note: '定植〜完熟収穫まで約1200〜1400℃' },
  'トウモロコシ': { targetTemp: 850, baseTemp: 10, note: '播種〜収穫まで約800〜900℃（絹糸抽出後約450℃）' },
  'スイートコーン': { targetTemp: 850, baseTemp: 10, note: '播種〜収穫まで約800〜900℃' },
  'キャベツ': { targetTemp: 1200, baseTemp: 5, note: '定植〜結球収穫まで約1100〜1400℃' },
  'レタス': { targetTemp: 800, baseTemp: 5, note: '定植〜結球収穫まで約700〜900℃' },
  'サニーレタス': { targetTemp: 650, baseTemp: 5, note: '定植〜収穫まで約600〜750℃' },
  'ブロッコリー': { targetTemp: 1000, baseTemp: 5, note: '定植〜頂花蕾収穫まで約900〜1100℃' },
  'カリフラワー': { targetTemp: 1050, baseTemp: 5, note: '定植〜花蕾収穫まで約950〜1150℃' },
  'ハクサイ': { targetTemp: 1100, baseTemp: 5, note: '定植〜結球収穫まで約1000〜1200℃' },
  '白菜': { targetTemp: 1100, baseTemp: 5, note: '定植〜結球収穫まで約1000〜1200℃' },
  'ダイコン': { targetTemp: 900, baseTemp: 5, note: '播種〜肥大収穫まで約800〜1000℃' },
  '大根': { targetTemp: 900, baseTemp: 5, note: '播種〜肥大収穫まで約800〜1000℃' },
  'ニンジン': { targetTemp: 1200, baseTemp: 5, note: '播種〜収穫まで約1100〜1300℃' },
  '人参': { targetTemp: 1200, baseTemp: 5, note: '播種〜収穫まで約1100〜1300℃' },
  'タマネギ': { targetTemp: 1800, baseTemp: 4, note: '定植〜倒伏・収穫まで約1700〜2000℃' },
  '玉ねぎ': { targetTemp: 1800, baseTemp: 4, note: '定植〜倒伏・収穫まで約1700〜2000℃' },
  'ネギ': { targetTemp: 2000, baseTemp: 4, note: '定植〜軟白収穫まで約1800〜2200℃' },
  '長ねぎ': { targetTemp: 2000, baseTemp: 4, note: '定植〜軟白収穫まで約1800〜2200℃' },
  'ホウレンソウ': { targetTemp: 500, baseTemp: 4, note: '播種〜収穫まで約400〜600℃' },
  'ほうれん草': { targetTemp: 500, baseTemp: 4, note: '播種〜収穫まで約400〜600℃' },
  'コマツナ': { targetTemp: 400, baseTemp: 4, note: '播種〜収穫まで約350〜500℃' },
  '小松菜': { targetTemp: 400, baseTemp: 4, note: '播種〜収穫まで約350〜500℃' },
  'エダマメ': { targetTemp: 750, baseTemp: 10, note: '播種〜莢肥大収穫まで約700〜850℃' },
  '枝豆': { targetTemp: 750, baseTemp: 10, note: '播種〜莢肥大収穫まで約700〜850℃' },
  'ジャガイモ': { targetTemp: 1200, baseTemp: 5, note: '萌芽〜収穫まで約1100〜1300℃' },
  'じゃがいも': { targetTemp: 1200, baseTemp: 5, note: '萌芽〜収穫まで約1100〜1300℃' },
  'サツマイモ': { targetTemp: 2300, baseTemp: 15, note: '苗植付〜収穫まで約2200〜2500℃' },
  'さつまいも': { targetTemp: 2300, baseTemp: 15, note: '苗植付〜収穫まで約2200〜2500℃' },
  'スイカ': { targetTemp: 900, baseTemp: 12, note: '着果〜完熟収穫まで約850〜1000℃' },
  'メロン': { targetTemp: 1100, baseTemp: 12, note: '着果〜成熟収穫まで約1000〜1200℃' },
  'イチゴ': { targetTemp: 550, baseTemp: 5, note: '開花〜色づき収穫まで約500〜600℃' },
  '水稲': { targetTemp: 1000, baseTemp: 10, note: '出穂〜登熟収穫まで約950〜1050℃' },
  '米': { targetTemp: 1000, baseTemp: 10, note: '出穂〜登熟収穫まで約950〜1050℃' },
};

/**
 * 作物名から目標積算温度を取得（部分一致対応）
 */
export function getCropTargetTemp(cropName: string): { targetTemp: number; baseTemp: number; note: string } {
  if (!cropName) {
    return { targetTemp: 1000, baseTemp: 10, note: '標準値（1000℃）' };
  }

  const cleanName = cropName.trim();
  if (CROP_ACCUMULATED_TEMP_DEFAULTS[cleanName]) {
    return CROP_ACCUMULATED_TEMP_DEFAULTS[cleanName];
  }

  // 部分一致
  for (const [key, val] of Object.entries(CROP_ACCUMULATED_TEMP_DEFAULTS)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return val;
    }
  }

  return { targetTemp: 1000, baseTemp: 10, note: '標準目安値（1000℃）' };
}

export interface DailyWeatherData {
  date: string;
  tempMax: number;
  tempMin: number;
  tempMean: number; // (最高 + 最低) / 2
  sunshineHours: number; // 日照時間(h)
  precipitation: number; // 降水量(mm)
  isForecast?: boolean;
}

export interface AccumulatedWeatherResult {
  address?: string;             // 逆引き住所（都道府県・市区町村）
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  
  // 実績積算データ
  accumulatedTemp: number;      // 積算温度 (℃)
  accumulatedSunshine: number;  // 積算日照 (h)
  accumulatedRain: number;      // 積算雨量 (mm)
  
  // 収穫予測
  targetTemp: number;           // 目標積算温度
  progressPercent: number;      // 到達進捗率 (%)
  remainingTemp: number;        // 残り必要温度 (℃)
  estimatedHarvestDate: string | null; // 予想収穫適期日 (YYYY-MM-DD)
  daysUntilHarvest: number | null;     // 収穫までの予想残り日数
  
  // アラート
  alerts: Array<{
    type: 'drought' | 'heavy_rain' | 'high_temp' | 'frost' | 'harvest_ready';
    level: 'info' | 'warning' | 'danger';
    title: string;
    message: string;
  }>;
  
  // グラフ用日別データ
  dailyHistory: DailyWeatherData[];
  forecastDaily: DailyWeatherData[];
}

/**
 * 緯度経度から住所を逆引き取得する（BigDataCloud / OSM）
 */
export async function fetchReverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ja`
    );
    if (res.ok) {
      const data = await res.json();
      const addr = `${data.principalSubdivision || ''}${data.locality || ''}${data.city || ''}`;
      if (addr.trim()) return addr;
    }
  } catch (e) {
    // フォールバック
  }

  try {
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      { headers: { 'Accept-Language': 'ja' } }
    );
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      if (osmData.display_name) {
        return osmData.display_name.split(',').slice(0, 3).reverse().join(' ');
      }
    }
  } catch (e) {}

  return `北緯${lat.toFixed(4)}°, 東経${lng.toFixed(4)}° 付近`;
}

/**
 * 緯度経度・作業開始日・終了日から積算気象データおよび収穫予測を取得・計算する
 */
export async function fetchFieldAccumulatedWeather(
  latitude: number,
  longitude: number,
  startDateStr: string,
  cropName: string,
  customTargetTemp?: number,
  customEndDateStr?: string
): Promise<AccumulatedWeatherResult> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const startDate = new Date(startDateStr);
  const targetEndStr = customEndDateStr || todayStr;
  
  // 日付の安全チェック
  const actualStartStr = startDate > today ? todayStr : startDateStr;

  // 住所の逆引きを並行取得
  const addressPromise = fetchReverseGeocode(latitude, longitude);

  // 目標積算温度の決定
  const cropSetting = getCropTargetTemp(cropName);
  const targetTemp = customTargetTemp || cropSetting.targetTemp;

  // 1. Open-Meteo API から過去実績 + 向こう14日間の予報を取得
  const forecastEndStr = addDaysStr(targetEndStr > todayStr ? targetEndStr : todayStr, 14);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,sunshine_duration,precipitation_sum&start_date=${actualStartStr}&end_date=${forecastEndStr}&timezone=Asia%2FTokyo`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`気象データ取得失敗: ${res.statusText}`);
  }

  const [data, resolvedAddress] = await Promise.all([res.json(), addressPromise]);
  const daily = data.daily || {};
  const dates: string[] = daily.time || [];
  const maxTemps: number[] = daily.temperature_2m_max || [];
  const minTemps: number[] = daily.temperature_2m_min || [];
  const sunshineSecs: number[] = daily.sunshine_duration || [];
  const rains: number[] = daily.precipitation_sum || [];

  const historyList: DailyWeatherData[] = [];
  const forecastList: DailyWeatherData[] = [];

  let accTemp = 0;
  let accSun = 0;
  let accRain = 0;

  for (let i = 0; i < dates.length; i++) {
    const dStr = dates[i];
    const tMax = maxTemps[i] ?? 20;
    const tMin = minTemps[i] ?? 10;
    const tMean = Math.round(((tMax + tMin) / 2) * 10) / 10;
    const sunHours = Math.round(((sunshineSecs[i] ?? 0) / 3600) * 10) / 10;
    const rain = Math.round((rains[i] ?? 0) * 10) / 10;

    const isPastOrToday = dStr <= todayStr;

    const dayObj: DailyWeatherData = {
      date: dStr,
      tempMax: tMax,
      tempMin: tMin,
      tempMean: tMean,
      sunshineHours: sunHours,
      precipitation: rain,
      isForecast: !isPastOrToday
    };

    if (isPastOrToday) {
      historyList.push(dayObj);
      accTemp += tMean;
      accSun += sunHours;
      accRain += rain;
    } else {
      forecastList.push(dayObj);
    }
  }

  accTemp = Math.round(accTemp * 10) / 10;
  accSun = Math.round(accSun * 10) / 10;
  accRain = Math.round(accRain * 10) / 10;

  // 収穫適期予測計算
  const remainingTemp = Math.max(0, targetTemp - accTemp);
  const progressPercent = Math.min(100, Math.round((accTemp / targetTemp) * 100));

  let estimatedHarvestDate: string | null = null;
  let daysUntilHarvest: number | null = null;

  if (accTemp >= targetTemp) {
    estimatedHarvestDate = todayStr;
    daysUntilHarvest = 0;
  } else {
    // 予報気温を使ってシミュレーション
    let tempSum = accTemp;
    let foundDate: string | null = null;
    let daysCount = 0;

    // 未来予報でシミュレーション
    for (const fDay of forecastList) {
      tempSum += fDay.tempMean;
      daysCount++;
      if (tempSum >= targetTemp) {
        foundDate = fDay.date;
        break;
      }
    }

    // 予報日数（14日）を超える場合は、直近の平均気温で推計
    if (!foundDate) {
      const avgRecentTemp = forecastList.length > 0
        ? forecastList.reduce((s, d) => s + d.tempMean, 0) / forecastList.length
        : 20;
      
      const additionalDaysNeeded = Math.ceil((targetTemp - tempSum) / Math.max(5, avgRecentTemp));
      daysCount += additionalDaysNeeded;
      foundDate = addDaysStr(todayStr, daysCount);
    }

    estimatedHarvestDate = foundDate;
    daysUntilHarvest = daysCount;
  }

  // アラート判定
  const alerts: AccumulatedWeatherResult['alerts'] = [];

  // 1. 収穫適期到達
  if (progressPercent >= 100) {
    alerts.push({
      type: 'harvest_ready',
      level: 'info',
      title: '🎉 収穫適期に到達！',
      message: `目標積算温度（${targetTemp}℃）に到達しました。色づき・実入りを確認し、収穫適期を迎えています。`
    });
  } else if (progressPercent >= 90) {
    alerts.push({
      type: 'harvest_ready',
      level: 'info',
      title: '🌾 まもなく収穫期',
      message: `目標積算温度の90%を超過（あと約${daysUntilHarvest}日）。収穫・出荷準備の目安時期です。`
    });
  }

  // 2. 土壌乾燥・潅水アラート（直近4日間の雨量が0mm）
  const recentHistory = historyList.slice(-4);
  const recentRainSum = recentHistory.reduce((sum, d) => sum + d.precipitation, 0);
  if (recentHistory.length >= 3 && recentRainSum === 0) {
    alerts.push({
      type: 'drought',
      level: 'warning',
      title: '💧 土壌乾燥注意・潅水推奨',
      message: '直近4日間に降雨が記録されていません。圃場の土壌水分を確認し、必要に応じて潅水を行ってください。'
    });
  }

  // 3. 高温多湿アラート（直近3日間の平均気温が28℃以上かつ降雨あり）
  const recentAvgTemp = recentHistory.length > 0 ? recentHistory.reduce((sum, d) => sum + d.tempMean, 0) / recentHistory.length : 0;
  if (recentAvgTemp >= 28 && recentRainSum > 5) {
    alerts.push({
      type: 'high_temp',
      level: 'warning',
      title: '⚠️ 高温多湿・病害虫注意',
      message: '高温かつ多湿な環境が続いています。軟腐病・疫病・ハダニ等の発生予防のため防除を点検してください。'
    });
  }

  return {
    address: resolvedAddress,
    latitude,
    longitude,
    startDate: actualStartStr,
    endDate: targetEndStr,
    totalDays: historyList.length,
    accumulatedTemp: accTemp,
    accumulatedSunshine: accSun,
    accumulatedRain: accRain,
    targetTemp,
    progressPercent,
    remainingTemp,
    estimatedHarvestDate,
    daysUntilHarvest,
    alerts,
    dailyHistory: historyList,
    forecastDaily: forecastList
  };
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
