"use client";

import React, { useState, useEffect } from 'react';
import { Sun, CloudRain, Thermometer, Calendar, AlertTriangle, CheckCircle2, Droplets, Sparkles, TrendingUp, ChevronRight, HelpCircle, Loader2 } from 'lucide-react';
import { AccumulatedWeatherResult, DailyWeatherData } from '@/lib/weather';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, CartesianGrid } from 'recharts';

interface FieldWeatherCardProps {
  fieldId: string;
  fieldName: string;
  latitude: number;
  longitude: number;
  startDate: string;
  cropName: string;
  customTargetTemp?: number;
}

export default function FieldWeatherCard({
  fieldId,
  fieldName,
  latitude,
  longitude,
  startDate,
  cropName,
  customTargetTemp
}: FieldWeatherCardProps) {
  const [weatherData, setWeatherData] = useState<AccumulatedWeatherResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetTemp, setTargetTemp] = useState<number | undefined>(customTargetTemp);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    fetchWeather();
  }, [fieldId, latitude, longitude, startDate, cropName, targetTemp]);

  const fetchWeather = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/weather/accumulated?lat=${latitude}&lng=${longitude}&startDate=${startDate}&crop=${encodeURIComponent(cropName)}`;
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-center min-h-[160px]">
        <div className="flex items-center space-x-3 text-emerald-600 font-bold">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>圃場ピンポイント気象データを集計・解析中...</span>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-slate-500 text-sm">
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

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-700/60 overflow-hidden relative">
      {/* 背景装飾 */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> 生育・気象AIカルテ
            </span>
            <span className="text-xs text-slate-400">
              {weatherData.startDate}（作業開始）〜 {weatherData.endDate}（{weatherData.totalDays}日間）
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            <span>{fieldName}</span>
            <span className="text-sm font-normal text-slate-300">({cropName})</span>
          </h3>
        </div>

        {/* 収穫予想バッジ */}
        {weatherData.estimatedHarvestDate && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl px-4 py-2 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-emerald-300 font-semibold">予想収穫適期</div>
              <div className="text-base font-extrabold text-white">
                {weatherData.estimatedHarvestDate}{' '}
                <span className="text-xs font-bold text-emerald-400">
                  {weatherData.daysUntilHarvest === 0
                    ? '(今が適期！)'
                    : `(あと${weatherData.daysUntilHarvest}日)`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3大気象積算メトリクス */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        {/* 積算温度 */}
        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span className="flex items-center gap-1 text-amber-300">
              <Thermometer className="w-4 h-4" /> 積算温度 (日平均気温計)
            </span>
            <span>目標 {weatherData.targetTemp}℃</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{weatherData.accumulatedTemp}</span>
            <span className="text-slate-400 text-sm">/ {weatherData.targetTemp} ℃</span>
          </div>
          {/* プログレスバー */}
          <div className="w-full bg-slate-700 h-2.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                weatherData.progressPercent >= 100
                  ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                  : 'bg-gradient-to-r from-amber-400 to-emerald-400'
              }`}
              style={{ width: `${weatherData.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
            <span>到達進捗率: {weatherData.progressPercent}%</span>
            <span>残り: {weatherData.remainingTemp}℃</span>
          </div>
        </div>

        {/* 積算日照時間 */}
        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span className="flex items-center gap-1 text-orange-400">
              <Sun className="w-4 h-4" /> 積算日照時間
            </span>
            <span>{weatherData.totalDays}日平均: {Math.round((weatherData.accumulatedSunshine / Math.max(1, weatherData.totalDays)) * 10) / 10}h/日</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold text-orange-300">{weatherData.accumulatedSunshine}</span>
            <span className="text-slate-400 text-sm">時間</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            光合成・糖度形成に必要な日照エネルギーの総量を正確に追跡
          </p>
        </div>

        {/* 積算降水量 */}
        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span className="flex items-center gap-1 text-blue-400">
              <CloudRain className="w-4 h-4" /> 積算降水量
            </span>
            <span>総雨量</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold text-blue-300">{weatherData.accumulatedRain}</span>
            <span className="text-slate-400 text-sm">mm</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            圃場が受けた自然降雨の総量。土壌水分・潅水頻度の目安
          </p>
        </div>
      </div>

      {/* スマート気象アラート */}
      {weatherData.alerts && weatherData.alerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {weatherData.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`rounded-xl p-3.5 border flex items-start space-x-3 ${
                alert.level === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
              <div className="text-sm">
                <div className="font-bold text-white">{alert.title}</div>
                <div className="text-xs text-slate-300 mt-0.5">{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* グラフ展開ボタン */}
      <div className="flex justify-between items-center pt-2 border-t border-slate-700/60">
        <button
          onClick={() => setShowChart(!showChart)}
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
        >
          <span>{showChart ? '▲ 気象推移チャートを閉じる' : '▼ 気温・雨量・日照の日別推移チャートを表示'}</span>
        </button>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>目標温度の変更:</span>
          <input
            type="number"
            value={targetTemp || weatherData.targetTemp}
            onChange={(e) => setTargetTemp(Number(e.target.value))}
            className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-0.5 text-white font-bold text-xs"
          />
          <span>℃</span>
        </div>
      </div>

      {/* 気象チャート（展開時） */}
      {showChart && (
        <div className="mt-4 pt-4 border-t border-slate-700/40">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                <YAxis yAxisId="temp" stroke="#f59e0b" fontSize={11} unit="℃" />
                <YAxis yAxisId="rain" orientation="right" stroke="#38bdf8" fontSize={11} unit="mm" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar yAxisId="rain" dataKey="precipitation" name="降水量(mm)" fill="#38bdf8" opacity={0.6} />
                <Line yAxisId="temp" type="monotone" dataKey="tempMean" name="平均気温(℃)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="temp" type="monotone" dataKey="sunshineHours" name="日照時間(h)" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
