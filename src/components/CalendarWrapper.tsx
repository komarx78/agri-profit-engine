"use client";

import React, { useState } from 'react';
import { Clock, MapPin, Sprout, Users, X, Calendar as CalendarIcon, ChevronRight, UserCheck, Star, Sparkles } from 'lucide-react';

interface CalendarProps {
  t: (key: string, lang?: any) => string;
  language: string;
  events: any[];
  currentWorkerId?: string;
  currentWorkerName?: string;
  allWorkers?: any[];
}

export default function CalendarWrapper({ events, t, language, currentWorkerId, currentWorkerName, allWorkers = [] }: CalendarProps) {
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [selectedTargetWorker, setSelectedTargetWorker] = useState<string>(currentWorkerName || '');
  
  // ログイン中の名前が変わったら更新
  React.useEffect(() => {
    if (currentWorkerName) {
      setSelectedTargetWorker(currentWorkerName);
    }
  }, [currentWorkerName]);

  const getWeekDaysArray = (lang: string) => {
    switch(lang) {
      case 'en': return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      case 'vi': return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      case 'id': return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      case 'zh': return ['日', '一', '二', '三', '四', '五', '六'];
      case 'si': return ['ඉරි', 'සඳු', 'අඟ', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන'];
      case 'km': return ['អា', 'ច', 'អ', 'ពុ', 'ព្រ', 'សុ', 'ស'];
      default: return ['日', '月', '火', '水', '木', '金', '土'];
    }
  };

  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeDateStr = (d: any) => {
    if (!d) return '';
    if (typeof d === 'string') {
      const clean = d.split('T')[0].replace(/\//g, '-');
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return clean;
    }
    return '';
  };

  const isEventForMe = (event: any) => {
    const target = selectedTargetWorker || currentWorkerName;
    if (!target) return false;
    if (event.workerName && (event.workerName === target || event.workerName.includes(target))) return true;
    if (currentWorkerId && event.workerId === currentWorkerId) return true;
    return false;
  };

  const myEventsCount = events.filter(isEventForMe).length;

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = formatLocalDate(d);
    return {
      dateObj: d,
      dateStr: dateStr,
      dayName: getWeekDaysArray(language)[d.getDay()],
      isToday: i === 0
    };
  });

  const selectedDayEvents = selectedDate ? events.filter(e => normalizeDateStr(e.date) === selectedDate) : [];
  const selectedDayObj = weekDays.find(d => d.dateStr === selectedDate);

  return (
    <div className="space-y-4 relative">
      
      {/* 絞り込みフィルターバー */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-black">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              filterMode === 'all' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t('cal_allEvents', language)}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('mine')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              filterMode === 'mine' 
                ? 'bg-amber-500 text-white shadow-sm' 
                : 'text-slate-500 hover:text-amber-700'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>{t('cal_myTasksOnly', language)} {myEventsCount > 0 && `(${myEventsCount})`}</span>
          </button>
        </div>

        {/* 担当者指定セレクター */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('cal_targetWorker', language)}</span>
          </span>
          <select
            value={selectedTargetWorker}
            onChange={(e) => setSelectedTargetWorker(e.target.value)}
            className="px-3 py-1.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs font-black text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-xs"
          >
            <option value="">{t('cal_allStaffOption', language)}</option>
            {allWorkers.map((w: any) => (
              <option key={w.id} value={w.name}>{w.name}</option>
            ))}
          </select>
          {selectedTargetWorker && (
            <span className="text-[11px] font-bold text-amber-600 hidden sm:inline-block">
              🟡「{selectedTargetWorker}」{t('cal_highlighting', language)}
            </span>
          )}
        </div>
      </div>

      {/* 水平スクロール可能なカレンダーマトリックスUI */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-7 gap-2 min-w-[800px]">
          {weekDays.map(day => {
            let dayEvents = events.filter(e => normalizeDateStr(e.date) === day.dateStr);
            if (filterMode === 'mine') {
              dayEvents = dayEvents.filter(isEventForMe);
            }

            return (
              <div 
                key={day.dateStr} 
                className="flex flex-col gap-3 group cursor-pointer"
                onClick={() => setSelectedDate(day.dateStr)}
              >
                {/* 日付ヘッダー */}
                <div 
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center transition-all shadow-sm group-hover:ring-2 ring-blue-400 ${day.isToday ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                >
                  <span className="text-xs font-bold mb-1">{day.dayName}</span>
                  <span className={`text-lg font-black ${day.isToday ? 'text-white' : 'text-slate-800'}`}>{day.dateObj.getDate()}</span>
                </div>

                {/* タスクブロックエリア */}
                <div className="flex flex-col gap-2 flex-1 bg-slate-50/50 rounded-xl p-1.5 min-h-[150px] group-hover:bg-blue-50/30 transition-colors">
                  {dayEvents.length > 0 ? (
                    dayEvents.map(event => {
                      const isMine = isEventForMe(event);
                      return (
                        <div 
                          key={event.id} 
                          className={`p-2.5 rounded-xl border shadow-sm flex flex-col gap-1.5 transition-all ${
                            isMine
                              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-300/60 shadow-md' 
                              : day.isToday 
                              ? 'bg-white border-blue-200' 
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className={`w-6 h-1 rounded-full ${isMine ? 'bg-amber-500' : day.isToday ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                            {isMine && (
                              <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-white" /> {t('cal_you', language)}
                              </span>
                            )}
                          </div>
                          <h4 className={`text-xs leading-snug break-words ${isMine ? 'font-black text-amber-950' : 'font-black text-slate-800'}`}>
                            {event.title}
                          </h4>
                          
                          {/* 誰が・どこで の簡易表示 */}
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {event.workerName && (
                              <div className={`flex items-center gap-1 text-[10px] font-bold truncate ${isMine ? 'text-amber-800' : 'text-slate-500'}`}>
                                <Users className={`w-3 h-3 flex-shrink-0 ${isMine ? 'text-amber-600' : 'text-blue-500'}`} />
                                <span className="truncate">{event.workerName} {isMine && ` ${t('cal_meTag', language)}`}</span>
                              </div>
                            )}
                            {(event.fieldName || event.cropName) && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold truncate">
                                <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                <span className="truncate">{event.fieldName} {event.cropName && `(${event.cropName})`}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center p-2 rounded-xl">
                      <span className="text-xs text-slate-300 font-bold">-</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 1日詳細モーダル */}
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedDate(null)}>
          <div 
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" 
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">
                    {selectedDate.replace(/-/g, '/')} ({selectedDayObj?.dayName})
                  </h3>
                  <p className="text-xs font-bold text-slate-500">1日のスケジュール詳細</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <p className="text-slate-400 font-bold">この日のタスク・予定はありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayEvents.map(event => {
                    const isMine = isEventForMe(event);
                    return (
                      <div 
                        key={event.id} 
                        className={`p-4 bg-white rounded-2xl border shadow-sm transition-all ${
                          isMine ? 'border-amber-300 ring-2 ring-amber-300/60 bg-amber-50/40' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black tracking-wider">
                            予定
                          </span>
                          {isMine && (
                            <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1">
                              <Star className="w-3 h-3 fill-white" /> あなたの担当タスク
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-slate-800 text-base mb-3">{event.title}</h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`p-3 rounded-xl border ${isMine ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                              <Users className="w-3 h-3" /> 担当者 (誰が)
                            </div>
                            <div className={`font-bold text-sm ${isMine ? 'text-amber-900 font-black' : 'text-slate-700'}`}>
                              {event.workerName || '全体'} {isMine && '(自分)'}
                            </div>
                          </div>
                          
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> 場所 (どこで)
                            </div>
                            <div className="font-bold text-slate-700 text-sm line-clamp-2">
                              {event.fieldName || '-'} 
                              {event.cropName && <span className="text-amber-600 ml-1">({event.cropName})</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100">
              <button 
                onClick={() => setSelectedDate(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
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
