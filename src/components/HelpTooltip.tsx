import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: React.ReactNode;
  className?: string;
}

export function HelpTooltip({ content, className = '' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 外側クリック（タップ）で閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={tooltipRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="text-emerald-400/70 hover:text-emerald-300 transition-colors focus:outline-none ml-1.5 p-1 -m-1"
        aria-label="ヘルプを表示"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-[240px] sm:w-64 p-3 mt-6 text-xs sm:text-sm font-normal text-slate-200 bg-emerald-900 border border-emerald-700/50 rounded-xl shadow-xl shadow-black/50 top-full left-1/2 -translate-x-1/2">
          {/* 吹き出しの矢印（上向き） */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-900 border-t border-l border-emerald-700/50 rotate-45"></div>
          <div className="relative z-10 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
