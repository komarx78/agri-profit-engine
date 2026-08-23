"use client";

import React, { useState } from 'react';
import { Clock, MapPin, Sprout, Users, X, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

interface CalendarProps {
  t: (key: string, lang?: any) => string;
  language: string;
  events: any[];
}

export default function CalendarWrapper({ events, t, language }: CalendarProps) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
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

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      dateObj: d,
      dateStr: d.toISOString().split('T')[0],
      dayName: getWeekDaysArray(language)[d.getDay()],
      isToday: i === 0
    };
  });

  const selectedDayEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];
  const selectedDayObj = weekDays.find(d => d.dateStr === selectedDate);

  return (
    <div className="space-y-4 relative">
      {/* 水平スクロール可能なカレンダーマトリックスUI */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-7 gap-2 min-w-[800px]">
          {weekDays.map(day => {
            const dayEvents = events.filter(e => e.date === day.dateStr);

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
                    dayEvents.map(event => (
                      <div 
                        key={event.id} 
                        className={`p-2.5 bg-white rounded-xl border shadow-sm flex flex-col gap-1.5 transition-colors ${day.isToday ? 'border-blue-200' : 'border-slate-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`w-6 h-1 rounded-full ${day.isToday ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                        </div>
                        <h4 className="font-black text-slate-800 text-xs leading-snug break-words">
                          {event.title}
                        </h4>
                        
                        {/* 誰が・どこで の簡易表示 */}
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {event.workerName && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold truncate">
                              <Users className="w-3 h-3 text-blue-500 flex-shrink-0" />
                              <span className="truncate">{event.workerName}</span>
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
                    ))
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
                  {selectedDayEvents.map(event => (
                    <div key={event.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black tracking-wider">
                          予定
                        </span>
                      </div>
                      <h4 className="font-black text-slate-800 text-base mb-3">{event.title}</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> 担当者 (誰が)
                          </div>
                          <div className="font-bold text-slate-700 text-sm">
                            {event.workerName || '全体'}
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
                  ))}
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
