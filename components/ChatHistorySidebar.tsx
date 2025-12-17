import React from 'react';
import { Project } from '../types';

interface ChatHistorySidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (project: Project) => void;
  onClose: () => void;
  onDelete: (e: React.MouseEvent, projectId: string) => void;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({ 
  projects, 
  activeProjectId, 
  onSelect, 
  onClose,
  onDelete
}) => {
  return (
    <div className="absolute inset-0 z-30 bg-[#09090b] flex flex-col animate-in slide-in-from-right duration-200 border-l border-white/5">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#09090b]">
        <h2 className="text-sm font-semibold text-gray-200">Previous Chats</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
        {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 opacity-20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                <span className="text-sm">No saved chats yet.</span>
            </div>
        ) : (
            projects.map(project => (
                <div 
                    key={project.id}
                    onClick={() => onSelect(project)}
                    className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${
                        activeProjectId === project.id 
                        ? 'bg-indigo-900/20 border-indigo-500/30' 
                        : 'bg-[#121212] border-white/5 hover:bg-white/5 hover:border-white/10'
                    }`}
                >
                    <div className="w-12 h-10 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 border border-white/5 relative">
                        {project.thumbnail ? (
                             <img src={project.thumbnail} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-700 text-[10px]">?</div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className={`text-xs font-medium truncate ${activeProjectId === project.id ? 'text-indigo-200' : 'text-gray-300'}`}>
                           {project.name}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                            {new Date(project.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {new Date(project.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                    <button 
                        onClick={(e) => onDelete(e, project.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all bg-black/20 hover:bg-black/50 rounded-md"
                        title="Delete Chat"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                           <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            ))
        )}
      </div>
    </div>
  );
};