"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sun, CloudRain, Thermometer, Calendar, AlertTriangle, CheckCircle2, 
  Droplets, Sparkles, TrendingUp, ChevronRight, HelpCircle, Loader2, 
  MapPin, Edit3, RotateCcw, Check, ArrowRight, RefreshCw, Satellite, ShieldCheck
} from 'lucide-react';
import { AccumulatedWeatherResult, DailyWeatherData, getCropTargetTemp } from '@/lib/weather';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, CartesianGrid } from 'recharts';

interface FieldWeatherCardProps {
  fieldId: string;
  fieldName: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate?: string;
  cropName: string;
  customTargetTemp?: number;
}

export default function FieldWeatherCard({
  fieldId,
  fieldName,
  latitude,
  longitude,
  startDate: initialStartDate,
  endDate: initialEndDate,
  cropName: initialCropName,
  customTargetTemp
}: FieldWeatherCardProps) {
  // フォーム入力用ステート
  const [inputStartDate, setInputStartDate] = useState<string>(initialStartDate);
  const [inputEndDate, setInputEndDate] = useState<string>(initialEndDate || new Date().toISOString().split('T')[0]);
  const [inputCrop, setInputCrop] = useState<string>(initialCropName);
  
  // 適用中パラメータ（APIに渡すパラメータ）
  const [appliedStartDate, setAppliedStartDate] = useState<string>(initialStartDate);
  const [appliedEndDate, setAppliedEndDate] = useState<string>(initialEndDate || new Date().toISOString().split('T')[0]);
  const [appliedCrop, setAppliedCrop] = useState<string>(initialCropName);

  // 目標温度（クライアント側で即時再計算可能なステート）
  const [targetTemp, setTargetTemp] = useState<number>(() => {
    return customTargetTemp || getCropTargetTemp(initialCropName).targetTemp;
  });

  const [isEditingParams, setIsEditingParams] = useState(false);
  const [weatherData, setWeatherData] = useState<AccumulatedWeatherResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);

  // 親propsの変更検知
  useEffect(() => {
    setInputStartDate(initialStartDate);
    setInputCrop(initialCropName);
    setAppliedStartDate(initialStartDate);
    setAppliedCrop(initialCropName);
    if (initialEndDate) {
      setInputEndDate(initialEndDate);
      setAppliedEndDate(initialEndDate);
    }
    if (customTargetTemp) {
      setTargetTemp(customTargetTemp);
    } else {
      setTargetTemp(getCropTargetTemp(initialCropName).targetTemp);
    }
  }, [initialStartDate, initialCropName, initialEndDate, customTargetTemp]);

  // appliedStartDate, appliedEndDate, appliedCrop が変更された時だけ API を取得
  useEffect(() => {
    fetchWeather();
  }, [fieldId, latitude, longitude, appliedStartDate, appliedEndDate, appliedCrop]);

  const fetchWeather = async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      let url = `/api/weather/accumulated?lat=${latitude}&lng=${longitude}&startDate=${appliedStartDate}&endDate=${appliedEndDate}&crop=${encodeURIComponent(appliedCrop)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '気象データ取得エラー');
      
      setWeatherData(json.data);
      // 作物基準の目標温度を自動セット（手動設定がない場合）
      if (!customTargetTemp && json.data.targetTemp) {
        setTargetTemp(json.data.targetTemp);
      }
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || '気象データの取得に失敗しました');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 期間・作物の適用ボタン
  const handleApplyParams = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedStartDate(inputStartDate);
    setAppliedEndDate(inputEndDate);
    setAppliedCrop(inputCrop);
  };

  // 初期値にリセット
  const handleResetToDefault = () => {
    setInputStartDate(initialStartDate);
    setInputEndDate(new Date().toISOString().split('T')[0]);
    setInputCrop(initialCropName);
    setAppliedStartDate(initialStartDate);
    setAppliedEndDate(new Date().toISOString().split('T')[0]);
    setAppliedCrop(initialCropName);
    const defT = customTargetTemp || getCropTargetTemp(initialCropName).targetTemp;
    setTargetTemp(defT);
    setIsEditingParams(false);
  };

  // 目標積算温度の手動変更に伴う即時クライアント再計算（API通信不要・0ミリ秒更新）
  const computedMetrics = useMemo(() => {
    if (!weatherData) return null;

    const accTemp = weatherData.accumulatedTemp;
    const safeTarget = Math.max(1, targetTemp || 1000);
    const remainingTemp = Math.max(0, safeTarget - accTemp);
    const progressPercent = Math.min(100, Math.round((accTemp / safeTarget) * 100));

    let estimatedHarvestDate: string | null = null;
    let daysUntilHarvest: number | null = null;
    const todayStr = new Date().toISOString().split('T')[0];

    if (accTemp >= safeTarget) {
      estimatedHarvestDate = todayStr;
      daysUntilHarvest = 0;
    } else {
      let tempSum = accTemp;
      let foundDate: string | null = null;
      let daysCount = 0;

      for (const fDay of weatherData.forecastDaily) {
        tempSum += fDay.tempMean;
        daysCount++;
        if (tempSum >= safeTarget) {
          foundDate = fDay.date;
          break;
        }
      }

      if (!foundDate) {
        const avgDaily = weatherData.dailyHistory.length > 0
          ? weatherData.dailyHistory.slice(-7).reduce((sum, d) => sum + d.tempMean, 0) / Math.min(7, weatherData.dailyHistory.length)
          : 20;
        const safeDaily = Math.max(1, avgDaily);
        const remDays = Math.ceil(remainingTemp / safeDaily);
        
        const d = new Date();
        d.setDate(d.getDate() + remDays);
        estimatedHarvestDate = d.toISOString().split('T')[0];
        daysUntilHarvest = remDays;
      } else {
        estimatedHarvestDate = foundDate;
        daysUntilHarvest = daysCount;
      }
    }

    return {
      safeTarget,
      remainingTemp,
      progressPercent,
      estimatedHarvestDate,
      daysUntilHarvest
    };
  }, [weatherData, targetTemp]);

  if (isLoading && !weatherData) {
    return (
      <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl flex items-center justify-center min-h-[200px]">
        <div className="flex items-center space-x-3 text-emerald-400 font-bold">
          <Loader2 className="w-7 h-7 animate-spin" />
          <span>気象庁・ECMWF高精度データ＆住所を照合中...</span>
        </div>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-slate-300 text-sm flex items-center justify-between">
        <span>気象データ取得中...（{fetchError || '接続中'}）</span>
        <button
          onClick={fetchWeather}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 再試行
        </button>
      </div>
    );
  }

  const metrics = computedMetrics || {
    safeTarget: targetTemp,
    remainingTemp: weatherData.remainingTemp,
    progressPercent: weatherData.progressPercent,
    estimatedHarvestDate: weatherData.estimatedHarvestDate,
    daysUntilHarvest: weatherData.daysUntilHarvest
  };

  // グラフ用データ
  const chartData = [
    ...weatherData.dailyHistory.map(d => ({
      ...d,
      type: '実績',
      label: d.date.slice(5)
    })),
    ...weatherData.forecastDaily.slice(0, 7).map(d => ({
      ...d,
      type: '予報',
      label: `${d.date.slice(5)}(予)`
    }))
  ];

  const popularCrops = ['トマト', 'ミニトマト', 'きゅうり', 'ナス', 'ピーマン', 'トウモロコシ', 'キャベツ', 'レタス', 'ブロッコリー', 'ダイコン', 'ニンジン', 'ネギ', 'ほうれん草', '枝豆', 'ジャガイモ', 'スイカ', 'メロン', 'イチゴ', '水稲'];

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-slate-800 overflow-hidden relative">
      {/* 背景装飾 */}
      <div className="absolute -right-16 -top-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* エラー通知（存在する場合のみ優しく表示） */}
      {fetchError && (
        <div className="mb-4 bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <span>⚠️ {fetchError}（直前の保存データを表示しています）</span>
          <button onClick={() => setFetchError(null)} className="text-amber-400 hover:text-white font-bold ml-2">閉じる</button>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" /> 生育・気象AIカルテ
            </span>

            {/* 📍 逆引き住所バッジ */}
            <div className="inline-flex items-center gap-1.5 bg-slate-800/90 text-slate-300 text-xs font-bold px-3 py-1 rounded-full border border-slate-700">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{weatherData.address || '圃場位置'}</span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                ({latitude.toFixed(4)}, {longitude.toFixed(4)})
              </span>
            </div>

            {isRefreshing && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-bold animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> 更新中...
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3 pt-1">
            <h3 className="text-2xl font-black text-white">{fieldName}</h3>
            <span className="text-emerald-400 font-black text-lg">({appliedCrop})</span>
          </div>
        </div>

        {/* 収穫適期バッジ & パラメータ編集ボタン */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditingParams(!isEditingParams)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
              isEditingParams
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingParams ? '調整パネルを閉じる' : '日付・作物を手入力変更'}</span>
          </button>

          {metrics.estimatedHarvestDate && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl px-4 py-2 flex items-center space-x-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/25 flex items-center justify-center text-emerald-300">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-wider">予想収穫適期</div>
                <div className="text-base font-black text-white">
                  {metrics.estimatedHarvestDate}{' '}
                  <span className="text-xs font-black text-emerald-400">
                    {metrics.daysUntilHarvest === 0
                      ? '(今が適期！)'
                      : `(あと${metrics.daysUntilHarvest}日)`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🛠️ 【手入力・条件調整パネル】 */}
      {isEditingParams && (
        <form onSubmit={handleApplyParams} className="mt-4 p-4 sm:p-5 bg-slate-900/90 rounded-2xl border border-emerald-500/30 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> 積算期間・作物の自由設定（手入力）
            </span>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>初期値に戻す</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 作業開始日 */}
            <div>
              <label className="text-[11px] font-black text-slate-400 block mb-1">
                📅 積算開始日（定植・播種日）
              </label>
              <input
                type="date"
                value={inputStartDate}
                onChange={(e) => setInputStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* 終了日 */}
            <div>
              <label className="text-[11px] font-black text-slate-400 block mb-1">
                📅 積算終了日（本日または指定日）
              </label>
              <input
                type="date"
                value={inputEndDate}
                onChange={(e) => setInputEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* 作物選択 / 手入力 */}
            <div>
              <label className="text-[11px] font-black text-slate-400 block mb-1">
                🌱 作物名
              </label>
              <input
                type="text"
                list="crop-suggestions-list"
                value={inputCrop}
                onChange={(e) => setInputCrop(e.target.value)}
                placeholder="例: トマト, キャベツ"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
              <datalist id="crop-suggestions-list">
                {popularCrops.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* 目標積算温度（即時反映） */}
            <div>
              <label className="text-[11px] font-black text-slate-400 block mb-1">
                🎯 目標積算温度 (℃) <span className="text-[10px] text-emerald-400">※即時反映</span>
              </label>
              <input
                type="number"
                value={targetTemp}
                onChange={(e) => setTargetTemp(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isRefreshing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>気象データを再取得・再計算</span>
            </button>
          </div>
        </form>
      )}

      {/* 期間サマリー表示 */}
      <div className="flex items-center gap-2 text-xs text-slate-400 mt-4 mb-2">
        <Calendar className="w-3.5 h-3.5 text-slate-500" />
        <span>
          集計期間: <strong className="text-white">{weatherData.startDate}</strong> 〜 <strong className="text-white">{weatherData.endDate}</strong>（実日数 <strong className="text-emerald-400">{weatherData.totalDays} 日間</strong>）
        </span>
      </div>

      {/* 3大気象積算メトリクス */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
        {/* 積算温度 */}
        <div className="bg-slate-900/90 backdrop-blur rounded-2xl p-5 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1.5">
            <span className="flex items-center gap-1.5 text-amber-300 font-black">
              <Thermometer className="w-4 h-4" /> 積算温度 (日平均気温計)
            </span>
            <span>目標 {metrics.safeTarget}℃</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl sm:text-4xl font-black text-white">{weatherData.accumulatedTemp}</span>
            <span className="text-slate-400 text-sm font-bold">/ {metrics.safeTarget} ℃</span>
          </div>
          {/* プログレスバー */}
          <div className="w-full bg-slate-800 h-3 rounded-full mt-3.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                metrics.progressPercent >= 100
                  ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : 'bg-gradient-to-r from-amber-400 to-emerald-400'
              }`}
              style={{ width: `${metrics.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-bold">
            <span>到達進捗率: {metrics.progressPercent}%</span>
            <span>残り: {metrics.remainingTemp}℃</span>
          </div>
        </div>

        {/* 積算日照時間 */}
        <div className="bg-slate-900/90 backdrop-blur rounded-2xl p-5 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1.5">
            <span className="flex items-center gap-1.5 text-orange-400 font-black">
              <Sun className="w-4 h-4" /> 積算日照時間
            </span>
            <span>1日平均: {Math.round((weatherData.accumulatedSunshine / Math.max(1, weatherData.totalDays)) * 10) / 10}h</span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl sm:text-4xl font-black text-orange-300">{weatherData.accumulatedSunshine}</span>
            <span className="text-slate-400 text-sm font-bold">時間</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3.5 leading-relaxed">
            光合成・糖度形成に必要な日照エネルギーの総量を正確に追跡
          </p>
        </div>

        {/* 積算降水量 */}
        <div className="bg-slate-900/90 backdrop-blur rounded-2xl p-5 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1.5">
            <span className="flex items-center gap-1.5 text-blue-400 font-black">
              <CloudRain className="w-4 h-4" /> 積算降水量
            </span>
            <span>自然雨量</span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl sm:text-4xl font-black text-blue-300">{weatherData.accumulatedRain}</span>
            <span className="text-slate-400 text-sm font-bold">mm</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3.5 leading-relaxed">
            圃場が受けた自然降雨の総量。土壌水分・潅水頻度の目安
          </p>
        </div>
      </div>

      {/* スマート気象アラート */}
      {weatherData.alerts && weatherData.alerts.length > 0 && (
        <div className="space-y-2 mb-5">
          {weatherData.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-4 border flex items-start space-x-3.5 ${
                alert.level === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
              <div className="text-sm">
                <div className="font-black text-white">{alert.title}</div>
                <div className="text-xs text-slate-300 mt-0.5">{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* グラフ展開ボタン */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-800">
        <button
          onClick={() => setShowChart(!showChart)}
          className="text-xs font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition"
        >
          <span>{showChart ? '▲ 気象推移チャートを閉じる' : '▼ 気温・雨量・日照の日別推移チャートを表示'}</span>
        </button>

        {/* データ出典情報 */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Satellite className="w-3.5 h-3.5 text-emerald-400" />
          <span>解析: 気象庁(JMA) / ECMWF全球モデル ＆ Open-Meteo API</span>
        </div>
      </div>

      {/* 気象チャート（展開時） */}
      {showChart && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="temp" stroke="#f59e0b" fontSize={11} unit="℃" />
                <YAxis yAxisId="rain" orientation="right" stroke="#38bdf8" fontSize={11} unit="mm" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar yAxisId="rain" dataKey="precipitation" name="降水量(mm)" fill="#38bdf8" opacity={0.7} />
                <Line yAxisId="temp" type="monotone" dataKey="tempMean" name="平均気温(℃)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 2 }} />
                <Line yAxisId="temp" type="monotone" dataKey="sunshineHours" name="日照時間(h)" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 📡 【気象データ解析根拠 & 出典フッター】 */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/50">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-300 block font-bold">全球高精度気象モデル</strong>
            <span>気象庁（JMA 高解像度数値予報MSM/GSM）および欧州ECMWF / 米国NOAA気象衛星データを統合解析</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Satellite className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-300 block font-bold">ピンポイント圃場気象</strong>
            <span>Open-Meteo Agricultural APIによる圃場緯度経度直下の気温・日照・降水量の自動積算</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-300 block font-bold">地理位置・地名特定</strong>
            <span>国土地理院 ＆ OpenStreetMap (OSM) 地理座標データベースによる逆引き住所照合</span>
          </div>
        </div>
      </div>
    </div>
  );
}
