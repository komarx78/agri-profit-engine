"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sun, CloudRain, Thermometer, Calendar, AlertTriangle, CheckCircle2, 
  Droplets, Sparkles, TrendingUp, ChevronRight, HelpCircle, Loader2, 
  MapPin, Edit3, RotateCcw, Check, ArrowRight
} from 'lucide-react';
import { AccumulatedWeatherResult, DailyWeatherData, CROP_ACCUMULATED_TEMP_DEFAULTS } from '@/lib/weather';
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
  // 操作用ローカルステート（手入力・自由変更用）
  const [currentStartDate, setCurrentStartDate] = useState<string>(initialStartDate);
  const [currentEndDate, setCurrentEndDate] = useState<string>(initialEndDate || new Date().toISOString().split('T')[0]);
  const [currentCrop, setCurrentCrop] = useState<string>(initialCropName);
  const [targetTemp, setTargetTemp] = useState<number | undefined>(customTargetTemp);
  const [isEditingParams, setIsEditingParams] = useState(false);

  const [weatherData, setWeatherData] = useState<AccumulatedWeatherResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChart, setShowChart] = useState(false);

  // 初回および親propsの変更検知
  useEffect(() => {
    setCurrentStartDate(initialStartDate);
    setCurrentCrop(initialCropName);
    if (initialEndDate) setCurrentEndDate(initialEndDate);
  }, [initialStartDate, initialCropName, initialEndDate]);

  useEffect(() => {
    fetchWeather();
  }, [fieldId, latitude, longitude, currentStartDate, currentEndDate, currentCrop, targetTemp]);

  const fetchWeather = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/weather/accumulated?lat=${latitude}&lng=${longitude}&startDate=${currentStartDate}&endDate=${currentEndDate}&crop=${encodeURIComponent(currentCrop)}`;
      if (targetTemp) {
        url += `&targetTemp=${targetTemp}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '気象データ取得エラー');
      setWeatherData(json.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '気象データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = () => {
    setCurrentStartDate(initialStartDate);
    setCurrentEndDate(new Date().toISOString().split('T')[0]);
    setCurrentCrop(initialCropName);
    setTargetTemp(customTargetTemp);
    setIsEditingParams(false);
  };

  if (isLoading && !weatherData) {
    return (
      <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl flex items-center justify-center min-h-[220px]">
        <div className="flex items-center space-x-3 text-emerald-400 font-bold">
          <Loader2 className="w-7 h-7 animate-spin" />
          <span>圃場ピンポイント気象データ & 住所を逆引き照合中...</span>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-slate-400 text-sm">
        気象データの取得ができませんでした（{error || 'データなし'}）
      </div>
    );
  }

  // グラフ用結合データ
  const chartData = [
    ...weatherData.dailyHistory.map(d => ({
      ...d,
      type: '実績',
      label: d.date.slice(5) // MM-DD
    })),
    ...weatherData.forecastDaily.slice(0, 7).map(d => ({
      ...d,
      type: '予報',
      label: `${d.date.slice(5)}(予)`
    }))
  ];

  const popularCrops = ['トマト', 'ミニトマト', 'きゅうり', 'ナス', 'ピーマン', 'トウモロコシ', 'キャベツ', 'レタス', 'ブロッコリー', 'ダイコン', 'ニンジン', 'ネギ', 'ほうれん草', '枝豆', 'ジャガイモ', 'スイカ', 'イチゴ', '水稲'];

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-slate-800 overflow-hidden relative">
      {/* 背景装飾 */}
      <div className="absolute -right-16 -top-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ヘッダー */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" /> 生育・気象AIカルテ
            </span>

            {/* 📍 逆引き住所バッジ（位置確認） */}
            <div className="inline-flex items-center gap-1.5 bg-slate-800/90 text-slate-300 text-xs font-bold px-3 py-1 rounded-full border border-slate-700">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{weatherData.address || '住所取得中...'}</span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                ({latitude.toFixed(4)}, {longitude.toFixed(4)})
              </span>
            </div>
          </div>

          <div className="flex items-baseline gap-3 pt-1">
            <h3 className="text-2xl font-black text-white">{fieldName}</h3>
            <span className="text-emerald-400 font-black text-lg">({currentCrop})</span>
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
            <span>{isEditingParams ? '設定パネルを閉じる' : '日付・作物を手入力変更'}</span>
          </button>

          {weatherData.estimatedHarvestDate && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl px-4 py-2 flex items-center space-x-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/25 flex items-center justify-center text-emerald-300">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-wider">予想収穫適期</div>
                <div className="text-base font-black text-white">
                  {weatherData.estimatedHarvestDate}{' '}
                  <span className="text-xs font-black text-emerald-400">
                    {weatherData.daysUntilHarvest === 0
                      ? '(今が適期！)'
                      : `(あと${weatherData.daysUntilHarvest}日)`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🛠️ 【手入力・条件調整パネル】（開閉可能） */}
      {isEditingParams && (
        <div className="mt-4 p-4 sm:p-5 bg-slate-900/90 rounded-2xl border border-emerald-500/30 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> 積算期間・作物の自由設定（手入力）
            </span>
            <button
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
                value={currentStartDate}
                onChange={(e) => setCurrentStartDate(e.target.value)}
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
                value={currentEndDate}
                onChange={(e) => setCurrentEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* 作物選択 / 手入力 */}
            <div>
              <label className="text-[11px] font-black text-slate-400 block mb-1">
                🌱 作物名（目標温度連動）
              </label>
              <input
                type="text"
                list="crop-suggestions"
                value={currentCrop}
                onChange={(e) => setCurrentCrop(e.target.value)}
                placeholder="例: トマト, キャベツ"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
              <datalist id="crop-suggestions">
                {popularCrops.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* 目標積算温度 */}
            <div>
              <label className="text-[11px] font-black text-slate-400 block mb-1">
                🎯 目標積算温度 (℃)
              </label>
              <input
                type="number"
                value={targetTemp || weatherData.targetTemp}
                onChange={(e) => setTargetTemp(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
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
            <span>目標 {weatherData.targetTemp}℃</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl sm:text-4xl font-black text-white">{weatherData.accumulatedTemp}</span>
            <span className="text-slate-400 text-sm font-bold">/ {weatherData.targetTemp} ℃</span>
          </div>
          {/* プログレスバー */}
          <div className="w-full bg-slate-800 h-3 rounded-full mt-3.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                weatherData.progressPercent >= 100
                  ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : 'bg-gradient-to-r from-amber-400 to-emerald-400'
              }`}
              style={{ width: `${weatherData.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-bold">
            <span>到達進捗率: {weatherData.progressPercent}%</span>
            <span>残り: {weatherData.remainingTemp}℃</span>
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

        <span className="text-xs text-slate-500">
          データ提供: Open-Meteo 高精度気象解析
        </span>
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
    </div>
  );
}
