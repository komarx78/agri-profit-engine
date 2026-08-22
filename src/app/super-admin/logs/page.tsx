"use client";

import React from 'react';
import { Activity, AlertTriangle, Terminal, Clock, RefreshCw } from 'lucide-react';

export default function SuperAdminLogsPage() {
  const dummyLogs = [
    { id: 1, type: 'error', message: 'Stripe webhook verification failed', tenant: 'tenant_uuid_a', time: '10 mins ago', code: '401' },
    { id: 2, type: 'warning', message: 'High CPU usage detected on Database', tenant: 'system', time: '1 hour ago', code: 'WARN_02' },
    { id: 3, type: 'error', message: 'Failed to parse FAMIC CSV row 459', tenant: 'admin', time: '2 hours ago', code: 'CSV_ERR' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-rose-500" />
            システムログ監視
          </h1>
          <p className="text-slate-400 text-sm mt-1">アプリケーション全体の動作ログ、エラーログを監視します。</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" /> 更新
        </button>
      </div>

      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center gap-4 text-sm font-bold text-slate-400">
          <Terminal className="w-4 h-4" />
          <span>最新のエラーログ</span>
        </div>
        <div className="divide-y divide-slate-800/50">
          {dummyLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-900/50 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className={`p-2 rounded-lg ${log.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${log.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {log.code}
                  </span>
                  <span className="text-slate-300 font-medium">{log.message}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> {log.tenant}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {log.time}</span>
                </div>
              </div>
              <button className="text-xs text-slate-400 hover:text-indigo-400 font-bold transition-colors">
                詳細を見る
              </button>
            </div>
          ))}
          {dummyLogs.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              エラーは検出されていません。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
