"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Sparkles,
  X,
  Send,
  MessageSquare,
  Bot,
  User,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Minimize2
} from 'lucide-react';

interface ActionLink {
  label: string;
  url: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionLinks?: ActionLink[];
  createdAt: Date;
}

interface AiAssistantProps {
  tenantId?: string;
  companyName?: string;
  farmCode?: string;
}

const QUICK_QUESTIONS = [
  { label: '📱 農園コード・アプリの使い方', text: 'スマホアプリで使う農園コードを教えてください。アプリの初期設定はどうすればいいですか？' },
  { label: '⏰ 出退勤打刻・日報の確認', text: '現場スタッフの出退勤や作業日報はどこで確認・承認できますか？' },
  { label: '📑 請求書の発行方法', text: '出荷先への請求書やインボイスの発行手順を教えてください。' },
  { label: '💊 農薬の検索と防除AI', text: '農薬の希釈倍率や安全使用日数を調べたいです。' },
  { label: '🗺️ 圃場マップと作付け計画', text: '圃場の作付け状況や栽培カレンダーはどこで見れますか？' },
];

export const AiAssistant: React.FC<AiAssistantProps> = ({
  tenantId = '',
  companyName = '当農園',
  farmCode = '',
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  const initialWelcomeMessage: Message = {
    id: 'welcome',
    role: 'assistant',
    content: `こんにちは！【${companyName || '当農園'}】の農業統合コンシェルジュAIです🌾\n\n現場アプリの接続方法や農園コード、日報・打刻、請求書、農薬、作付け計画など、システムの操作や疑問を何でもご質問ください！下のボタンからもワンタップでお尋ねいただけます。`,
    createdAt: new Date(),
  };

  const [messages, setMessages] = useState<Message[]>([initialWelcomeMessage]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初回スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // ツールチップを一定時間後に非表示にする（ユーザーの邪魔にならないよう）
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      // 履歴整形（直近6件）
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          companyName: companyName || '当農園',
          farmCode: farmCode || (tenantId === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04' ? 'kap' : tenantId === '62163024-2c8e-4057-a872-2455dbc58d32' ? 'sahara' : ''),
          tenantId: tenantId || '',
          currentPath: pathname || '',
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply || '回答を取得できませんでした。',
        actionLinks: data.actionLinks || [],
        createdAt: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      console.error('Assistant error:', err);
      const safeCode = farmCode || (tenantId === '83b1d7ad-6240-4fbf-8174-3dd4e2ff0c04' ? 'kap' : tenantId === '62163024-2c8e-4057-a872-2455dbc58d32' ? 'sahara' : '');
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `申し訳ございません。通信エラーが発生いたしました。時間を置いて再度お試しいただくか、直接各メニューをご利用ください。${safeCode ? `\n\n※貴社の農園コードは【${safeCode.toUpperCase()}】です。` : ''}`,
        actionLinks: [
          { label: '自社情報設定を開く', url: tenantId ? `/admin/settings?farm=${tenantId}` : '/admin/settings' },
        ],
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (url: string) => {
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      router.push(url);
    }
    // モバイルの場合はモーダルを閉じる
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([initialWelcomeMessage]);
  };

  return (
    <>
      {/* 画面右下のフローティングボタン */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end print:hidden">
        {/* 初回吹き出しツールチップ */}
        {showTooltip && !isOpen && (
          <div className="mb-2 bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow-xl flex items-center gap-2 animate-bounce cursor-pointer border border-slate-700" onClick={() => setIsOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>操作や農園コードの質問はこちら！</span>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTooltip(false); }}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {!isOpen ? (
          <button
            onClick={() => { setIsOpen(true); setShowTooltip(false); }}
            className="group relative flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white p-3.5 md:px-5 md:py-3.5 rounded-full shadow-2xl hover:shadow-emerald-500/30 transition-all duration-300 active:scale-95 cursor-pointer border border-white/20"
            title="農業AIコンシェルジュを開く"
          >
            <div className="relative">
              <Bot className="w-6 h-6 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
              </span>
            </div>
            <span className="hidden md:inline-block font-bold text-sm tracking-wide">
              質問AIボット
            </span>
          </button>
        ) : null}

        {/* チャットウィンドウモーダル */}
        {isOpen && (
          <div className="bg-white w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[85vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-5 py-3.5 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center border border-white/20">
                  <Bot className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <div className="font-black text-sm flex items-center gap-1.5">
                    孔明AI 案内コンシェルジュ
                    <span className="bg-emerald-500/40 text-[10px] text-emerald-200 px-1.5 py-0.2 rounded font-bold">PRO</span>
                  </div>
                  <div className="text-[11px] text-emerald-200 font-medium truncate max-w-[210px]">
                    {companyName} 専用アドバイザー
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="会話をリセット"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="閉じる"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* メッセージリスト */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/70 text-sm">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isUser
                          ? 'bg-slate-700 text-white'
                          : 'bg-emerald-600 text-white shadow-sm'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`max-w-[82%] space-y-2`}>
                      <div
                        className={`p-3.5 rounded-2xl shadow-xs leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-emerald-600 text-white rounded-tr-none font-medium'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {m.content}
                      </div>

                      {/* アクションリンクボタン */}
                      {!isUser && m.actionLinks && m.actionLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {m.actionLinks.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleNavigate(action.url)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow active:scale-95 cursor-pointer"
                            >
                              <span>👉 {action.label}</span>
                              <ArrowRight className="w-3 h-3 text-emerald-600" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white text-slate-500 border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-xs flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-75"></span>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150"></span>
                    <span className="text-xs font-medium text-slate-500">回答を生成中...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* クイック質問チップ（メッセージが2件以下の時や常に下部に配置） */}
            {messages.length <= 3 && !isLoading && (
              <div className="p-2.5 bg-slate-100/80 border-t border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 mb-1.5 px-1 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-emerald-600" />
                  よくあるご質問（タップで即答）
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {QUICK_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q.text)}
                      className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 入力エリア */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="質問を入力（例: 請求書の出し方は？）"
                className="flex-1 bg-slate-100 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white p-2.5 rounded-xl shadow-sm transition-all active:scale-95 disabled:active:scale-100 cursor-pointer disabled:cursor-not-allowed"
                title="送信"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
};
