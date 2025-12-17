import React, { useMemo } from 'react';
import { Layer } from '../types';

interface LayerPanelProps {
  layers: Layer[];
  onUpdate: (layers: Layer[]) => void;
  activeLayerId: string | null;
  onSelectLayer: (id: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ layers, onUpdate, activeLayerId, onSelectLayer }) => {
  
  const toggleVisibility = (id: string, list: Layer[]): Layer[] => {
    return list.map(layer => {
      if (layer.id === id) return { ...layer, visible: !layer.visible };
      if (layer.children) return { ...layer, children: toggleVisibility(id, layer.children) };
      return layer;
    });
  };

  const handleVisibility = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onUpdate(toggleVisibility(id, layers));
  };

  const deleteLayer = (id: string, list: Layer[]): Layer[] => {
    return list.filter(l => l.id !== id).map(l => ({
        ...l,
        children: l.children ? deleteLayer(id, l.children) : undefined
    }));
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this layer?")) {
        onUpdate(deleteLayer(id, layers));
    }
  };

  const moveLayer = (id: string, direction: 'up' | 'down', list: Layer[]): Layer[] => {
    const index = list.findIndex(l => l.id === id);
    if (index !== -1) {
        const newList = [...list];
        if (direction === 'up' && index > 0) {
            [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
            return newList;
        }
        if (direction === 'down' && index < list.length - 1) {
            [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
            return newList;
        }
        return list;
    }
    return list.map(l => {
        if (l.children) {
            return { ...l, children: moveLayer(id, direction, l.children) };
        }
        return l;
    });
  };

  const handleMove = (e: React.MouseEvent, id: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    onUpdate(moveLayer(id, direction, layers));
  };

  const activeLayer = useMemo(() => {
    const findLayer = (list: Layer[]): Layer | undefined => {
        for (const l of list) {
            if (l.id === activeLayerId) return l;
            if (l.children) {
                const found = findLayer(l.children);
                if (found) return found;
            }
        }
    };
    return findLayer(layers);
  }, [layers, activeLayerId]);

  const renderLayerList = (list: Layer[], depth = 0) => {
    return list.map((layer) => (
      <div key={layer.id} className="flex flex-col">
        <div 
            onClick={() => onSelectLayer(layer.id)}
            className={`flex items-center gap-2 p-2 border-b border-white/5 cursor-pointer transition-colors ${
                activeLayerId === layer.id ? 'bg-indigo-900/30' : 'hover:bg-white/5'
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
            <button 
                onClick={(e) => handleVisibility(e, layer.id)}
                className={`p-1 rounded hover:bg-white/10 ${layer.visible ? 'text-gray-300' : 'text-gray-600'}`}
            >
                {layer.visible ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" /></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-5.73.75.75 0 0 0 0-.5c-1.133-3.11-3.608-5.348-6.454-5.888a7.2 7.2 0 0 0-.954-.641l-8.647-8.647Zm9.395 9.395l-3.23-3.23a4 4 0 0 1 3.23 3.23ZM8.404 8.404l-1.46-1.46a4 4 0 0 0 1.46 1.46Zm-2.621 1.62a4 4 0 0 1 5.152 5.153L5.783 10.024Zm6.47 4.075l-1.636-1.636a7.199 7.199 0 0 1-3.414-.542 10.015 10.015 0 0 0 6.626-2.529l-1.576-1.576ZM6.37 6.37l-1.58-1.58A10.014 10.014 0 0 0 .664 9.41a1.651 1.651 0 0 0 0 1.186A10.014 10.014 0 0 0 10 17c1.373 0 2.682-.28 3.867-.783l-1.632-1.632A7.198 7.198 0 0 1 10 14c-1.927 0-3.68-.75-5.006-2.001l-.624-.624Z" clipRule="evenodd" /></svg>
                )}
            </button>

            {layer.type === 'group' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-yellow-500"><path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z" /></svg>
            ) : layer.type === 'text' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5v-4.5a.75.75 0 0 0-1.5 0v4.5h-2a.75.75 0 0 0 0 1.5h2v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h2a.75.75 0 0 0 0-1.5h-2v-4.5Z" /></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-400"><path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909.47.47a.75.75 0 1 1-1.06 1.06L6.53 8.091a.75.75 0 0 0-1.06 0l-2.97 2.97ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" /></svg>
            )}

            <span className="flex-1 text-xs truncate select-none text-gray-200">{layer.name}</span>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => handleMove(e, layer.id, 'up')} className="p-1 hover:text-white text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" /></svg></button>
                <button onClick={(e) => handleMove(e, layer.id, 'down')} className="p-1 hover:text-white text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" /></svg></button>
                <button onClick={(e) => handleDelete(e, layer.id)} className="p-1 hover:text-red-400 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
        {layer.children && layer.children.length > 0 && (
            <div className="border-l border-white/5 ml-4">
                {renderLayerList(layer.children, depth + 1)}
            </div>
        )}
      </div>
    ));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#09090b] text-white overflow-hidden">
        {layers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 opacity-20"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>
                <span className="text-sm">No layers</span>
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {renderLayerList(layers)}
            </div>
        )}
    </div>
  );
};