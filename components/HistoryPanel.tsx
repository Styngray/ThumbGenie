import React, { useEffect, useRef } from 'react';

interface HistoryPanelProps {
  history: string[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, currentIndex, onSelect, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={panelRef}
      className="absolute top-16 left-4 z-50 w-64 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-200 origin-top-left"
    >
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-blue-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Edit History
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
      
      <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {history.map((img, idx) => {
          const isCurrent = idx === currentIndex;
          const isOriginal = idx === 0;
          return (
            <button
              key={idx}
              onClick={() => {
                onSelect(idx);
                onClose();
              }}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all border ${
                isCurrent 
                  ? 'bg-blue-900/30 border-blue-500/50 ring-1 ring-blue-500/20' 
                  : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="relative w-12 h-8 shrink-0 rounded bg-gray-950 overflow-hidden border border-gray-700">
                 <img src={img} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className={`text-xs font-medium truncate ${isCurrent ? 'text-blue-200' : 'text-gray-300'}`}>
                   {isOriginal ? 'Original Image' : `Edit #${idx}`}
                </span>
                <span className="text-[10px] text-gray-500">
                   {isCurrent ? 'Current Version' : 'Restore this version'}
                </span>
              </div>
              {isCurrent && (
                <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
