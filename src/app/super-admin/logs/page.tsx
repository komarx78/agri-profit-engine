"use client";

import React, { useState } from 'react';
import { 
  Activity, AlertTriangle, Terminal, Clock, RefreshCw, 
  X, CheckCircle2, Copy, ShieldAlert, Cpu, Server, Database,
  ArrowRight, FileCode2
} from 'lucide-react';

interface SystemLog {
  id: number;
  type: 'error' | 'warning' | 'info';
  message: string;
  tenant: string;
  time: string;
  code: string;
  path?: string;
  stack?: string;
  payload?: any;
  recommendation?: string;
}

export default function SuperAdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([
    { 
      id: 1, 
      type: 'error', 
      message: 'Stripe webhook verification failed', 
      tenant: 'tenant_uuid_a', 
      time: '10分前', 
      code: '401',
      path: '/api/webhooks/stripe',
      stack: `StripeError: No signatures found matching the expected signature for payload\n    at Object.constructEvent (stripe/lib/Webhooks.js:37:13)\n    at POST (/app/api/webhooks/stripe/route.ts:18:24)`,
      payload: {
        event_type: 'invoice.payment_succeeded',
        stripe_signature: 't=1692800000,v1=9a8b7c6d5e4f...',
        client_ip: '54.187.174.169'
      },
      recommendation: 'STRIPE_WEBHOOK_SECRET 環境変数が最新の署名シークレットと一致しているか確認してください。'
    },
    { 
      id: 2, 
      type: 'warning', 
      message: 'High CPU usage detected on Database', 
      tenant: 'system', 
      time: '1時間前', 
      code: 'WARN_02',
      path: 'Supabase PostgreSQL Cluster (ap-northeast-1)',
      stack: `PostgresMetricsWarning: CPU threshold exceeded 85% for > 5m\nActive connections: 48\nSlow query: SELECT * FROM m_pesticide_usages WHERE crop_name LIKE '%ねぎ%'`,
      payload: {
        metric: 'cpu_usage',
        value: '88.4%',
        threshold: '80.0%',
        region: 'ap-northeast-1'
      },
      recommendation: '農薬検索インデックス（B-tree / GIN）が正しく適用されているか確認してください。'
    },
    { 
      id: 3, 
      type: 'error', 
      message: 'Failed to parse FAMIC CSV row 459', 
      tenant: 'admin', 
      time: '2時間前', 
      code: 'CSV_ERR',
      path: '/super-admin/pesticides (CSV Parser)',
      stack: `PapaParseError: Row 459 has 18 fields, expected 19 fields\nRaw: "12345","スミレックス水和剤","住友化学","...",,`,
      payload: {
        file_name: 'pesticide_usages_2026.csv',
        line_number: 459,
        delimiter: ','
      },
      recommendation: 'CSVファイルの459行目に余分なカンマまたは改行が含まれていないか確認してください。'
    },
  ]);

  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-rose-500" />
            システムログ監視
          </h1>
          <p className="text-slate-400 text-sm mt-1">アプリケーション全体の動作ログ、エラーログをリアルタイムで監視・診断します。</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} /> 
          ログを最新に更新
        </button>
      </div>

      {/* ログ一覧 */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-sm font-bold text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>最新のエラー・警告ログ ({logs.length}件)</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Realtime Monitoring Active</span>
        </div>
        <div className="divide-y divide-slate-800/50">
          {logs.map((log) => (
            <div 
              key={log.id} 
              className="p-5 hover:bg-slate-900/60 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between cursor-pointer group"
              onClick={() => setSelectedLog(log)}
            >
              <div className="flex items-start gap-3.5 flex-1">
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  log.type === 'error' 
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-md font-mono ${
                      log.type === 'error' 
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {log.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                      {log.message}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-slate-400" /> 
                      テナント: <span className="text-slate-300">{log.tenant}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> 
                      {log.time}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLog(log);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-black transition-all border border-slate-700 hover:border-indigo-500 shadow-sm shrink-0"
              >
                詳細を見る ➔
              </button>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="p-16 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-slate-300">異常は検知されていません</p>
              <p className="text-xs">全システムが正常に稼働しています。</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 診断詳細モーダル（周瑜の司令部デザイン） */}
      {/* ========================================================================= */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6 md:p-8">
            {/* モーダルヘッダー */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-md font-mono ${
                    selectedLog.type === 'error' 
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {selectedLog.code}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{selectedLog.time} 発生</span>
                </div>
                <h2 className="text-xl font-black text-white">
                  {selectedLog.message}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 推奨対応手順 */}
            {selectedLog.recommendation && (
              <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-4 space-y-1">
                <h4 className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  推奨される対応手順:
                </h4>
                <p className="text-sm font-bold text-slate-200">
                  {selectedLog.recommendation}
                </p>
              </div>
            )}

            {/* 発生元コンテキスト */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500">発生エンドポイント / モジュール</span>
                <p className="text-xs font-mono font-bold text-slate-300 break-all">{selectedLog.path || '-'}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-500">対象テナント / 実行主体</span>
                <p className="text-xs font-mono font-bold text-slate-300 break-all">{selectedLog.tenant}</p>
              </div>
            </div>

            {/* スタックトレース */}
            {selectedLog.stack && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-rose-400" />
                    スタックトレース (Stack Trace):
                  </span>
                  <button 
                    onClick={() => handleCopy(selectedLog.stack || '')}
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'コピー完了！' : 'コピー'}
                  </button>
                </div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-rose-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {selectedLog.stack}
                </pre>
              </div>
            )}

            {/* ペイロードデータ */}
            {selectedLog.payload && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-cyan-400" />
                  リクエスト / メトリクス ペイロード (Payload):
                </span>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            )}

            {/* モーダルフッター */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black rounded-xl transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
