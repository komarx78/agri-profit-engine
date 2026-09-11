"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, AlertTriangle, Terminal, Clock, RefreshCw, 
  X, CheckCircle2, Copy, ShieldAlert, Cpu, Server, Database,
  ArrowRight, FileCode2, Check, ExternalLink
} from 'lucide-react';

interface SystemLog {
  id: string | number;
  type: 'error' | 'warning' | 'info';
  message: string;
  tenant: string;
  worker?: string;
  time: string;
  rawTime?: string;
  code: string;
  path?: string;
  stack?: string;
  payload?: any;
  recommendation?: string;
  is_resolved?: boolean;
}

export default function SuperAdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 経過時間のフォーマット
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'たった今';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'たった今';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
      return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '日時不明';
    }
  };

  // 推奨アクションの自動生成
  const getRecommendation = (category: string, message: string) => {
    if (category === 'attendance' || message.includes('打刻') || message.includes('出勤') || message.includes('退勤')) {
      return '同日の重複打刻レコードが存在しないか、または作業者一覧テーブルのステータスを確認してください。';
    }
    if (category === 'login' || message.includes('ログイン') || message.includes('PIN')) {
      return 'スタッフマスタのPINコード設定および店舗/農園への所属紐付け（company_settings）を確認してください。';
    }
    if (message.includes('fetch') || message.includes('Network')) {
      return '現場端末の電波状況、またはオフラインキャッシュの同期状態を確認してください。';
    }
    return 'スタックトレースとリクエスト情報からエラーの原因箇所を調査・対応してください。';
  };

  // 実DBログ取得関数
  const fetchLogs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/system-error');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        if (data.tableReady === false) {
          setTableReady(false);
        } else {
          setTableReady(true);
        }
        const mapped: SystemLog[] = data.logs.map((item: any) => ({
          id: item.id,
          type: item.error_level || 'error',
          message: item.error_message || '不明なエラー',
          tenant: item.company_name || item.tenant_id || '未特定農園',
          worker: item.worker_name,
          time: formatTimeAgo(item.created_at),
          rawTime: item.created_at,
          code: item.error_category || 'SYSTEM_ERR',
          path: item.page_url,
          stack: item.error_stack,
          payload: {
            worker_id: item.worker_id,
            worker_name: item.worker_name,
            device_info: item.device_info,
            resolved: item.is_resolved,
            resolved_at: item.resolved_at
          },
          recommendation: getRecommendation(item.error_category, item.error_message),
          is_resolved: item.is_resolved
        }));
        setLogs(mapped);
      }
    } catch (e) {
      console.error('Fetch logs failed:', e);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    fetchLogs();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 解決ステータス更新
  const toggleResolveStatus = async (log: SystemLog) => {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const newStatus = !log.is_resolved;
      const res = await fetch('/api/system-error', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: log.id,
          is_resolved: newStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => prev.map(l => l.id === log.id ? { ...l, is_resolved: newStatus } : l));
        if (selectedLog && selectedLog.id === log.id) {
          setSelectedLog(prev => prev ? { ...prev, is_resolved: newStatus } : null);
        }
      }
    } catch (e) {
      console.error('Update status failed:', e);
    } finally {
      setIsUpdatingStatus(false);
    }
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

      {/* テーブル未配備時の案内バナー */}
      {!tableReady && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-200">
                system_error_logs テーブルが未配備です
              </h4>
              <p className="text-xs text-amber-400/80 mt-0.5">
                現場端末からのエラーログ自動永続化を有効化するため、Supabase SQL Editor にてマイグレーションSQLを実行してください。
              </p>
            </div>
          </div>
          <a
            href="https://supabase.com/dashboard/project/xqneyssirhwedoemfzph/sql"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/40 transition-colors shrink-0"
          >
            Supabase SQLエディタを開く <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ログ一覧 */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-sm font-bold text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>最新のエラー・警告ログ ({logs.length}件)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-slate-400 font-mono">Realtime Monitoring Active</span>
          </div>
        </div>
        <div className="divide-y divide-slate-800/50">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs font-mono">システムログを取得中...</p>
            </div>
          ) : logs.length > 0 ? (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-5 hover:bg-slate-900/60 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between cursor-pointer group ${
                  log.is_resolved ? 'opacity-60 bg-slate-950/40' : ''
                }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start gap-3.5 flex-1">
                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    log.is_resolved
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : log.type === 'error' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {log.is_resolved ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-md font-mono ${
                        log.is_resolved
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : log.type === 'error' 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {log.is_resolved ? 'RESOLVED' : log.code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                        {log.message}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Server className="w-3.5 h-3.5 text-slate-400" /> 
                        農園: <span className="text-slate-300">{log.tenant}</span>
                      </span>
                      {log.worker && (
                        <span className="flex items-center gap-1 text-slate-300 font-sans font-bold">
                          作業者: <span className="text-indigo-300">{log.worker}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> 
                        {log.time}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
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
              </div>
            ))
          ) : (
            <div className="p-16 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm text-slate-300">異常は検知されていません</p>
              <p className="text-xs">全システム・全現場端末が正常に稼働しています。</p>
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
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => toggleResolveStatus(selectedLog)}
                disabled={isUpdatingStatus}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                  selectedLog.is_resolved
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                }`}
              >
                {selectedLog.is_resolved ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    未解決に戻す
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    対応完了（解決済みにする）
                  </>
                )}
              </button>

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
