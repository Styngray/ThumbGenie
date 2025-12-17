
import React, { useState, useRef, useEffect } from 'react';

interface TextOverlayToolProps {
  imageSrc: string;
  onApply: (base64: string) => void;
  onCancel: () => void;
}

export const TextOverlayTool: React.FC<TextOverlayToolProps> = ({ imageSrc, onApply, onCancel }) => {
  const [text, setText] = useState("Enter Text");
  const [color, setColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(100); 
  const [position, setPosition] = useState({ x: 50, y: 50 }); // Center percent
  const [isDragging, setIsDragging] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const percentX = (deltaX / rect.width) * 100;
    const percentY = (deltaY / rect.height) * 100;
    
    setPosition(prev => ({
      x: Math.max(0, Math.min(100, prev.x + percentX)),
      y: Math.max(0, Math.min(100, prev.y + percentY))
    }));
    
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const endDrag = () => setIsDragging(false);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
    return () => {
        window.removeEventListener('mouseup', endDrag);
        window.removeEventListener('touchend', endDrag);
    };
  }, []);

  const handleApply = () => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Create canvas same size as original image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas (transparent background)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw text only
      ctx.fillStyle = color;
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const x = (position.x / 100) * canvas.width;
      const y = (position.y / 100) * canvas.height;
      
      // Add shadow for visibility
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = fontSize * 0.15;
      ctx.shadowOffsetX = fontSize * 0.05;
      ctx.shadowOffsetY = fontSize * 0.05;

      ctx.fillText(text, x, y);
      
      onApply(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
  };

  // Calculate displayed font size based on current image scaling
  const displayFontSize = imgRef.current && imgRef.current.naturalWidth
      ? (fontSize * (imgRef.current.width / imgRef.current.naturalWidth)) 
      : 20;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-in fade-in duration-200">
        {/* Header/Toolbar */}
        <div className="p-4 bg-[#121212] border-b border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 z-20">
             <div className="flex items-center gap-2 text-white font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Add Text Layer
             </div>

             <div className="flex flex-wrap items-center gap-4 bg-black/20 p-2 rounded-xl border border-white/5">
                 <input 
                    type="text" 
                    value={text} 
                    onChange={(e) => setText(e.target.value)}
                    className="bg-[#27272a] text-white px-3 py-1.5 rounded-lg border border-white/10 focus:border-indigo-500 outline-none text-sm min-w-[200px]"
                    placeholder="Enter text..."
                 />
                 
                 <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block"></div>

                 <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Size</label>
                    <input 
                        type="range" 
                        min="20" 
                        max="500" 
                        value={fontSize} 
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-24 accent-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs text-gray-300 w-8 text-right">{fontSize}</span>
                 </div>

                 <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">Color</label>
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20 cursor-pointer">
                        <input 
                            type="color" 
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"
                        />
                    </div>
                 </div>
             </div>

             <div className="flex items-center gap-3">
                 <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button>
                 <button onClick={handleApply} className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95">Add Layer</button>
             </div>
        </div>
        
        {/* Canvas */}
        <div 
             className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-[#050505] flex items-center justify-center p-8 overflow-hidden select-none"
             onMouseMove={handleMouseMove}
             onTouchMove={handleMouseMove}
        >
            <div ref={containerRef} className="relative shadow-2xl border border-white/10 max-w-full max-h-full">
                <img 
                    ref={imgRef}
                    src={imageSrc}
                    onLoad={() => setImgLoaded(true)}
                    className="max-h-[80vh] max-w-full object-contain pointer-events-none opacity-50" 
                    draggable={false}
                />
                
                {imgLoaded && (
                    <div 
                        style={{
                            position: 'absolute',
                            left: `${position.x}%`,
                            top: `${position.y}%`,
                            transform: 'translate(-50%, -50%)',
                            color: color,
                            fontSize: `${displayFontSize}px`,
                            fontWeight: 'bold',
                            fontFamily: 'Inter, sans-serif',
                            textShadow: `0px 0px ${displayFontSize * 0.1}px rgba(0,0,0,0.8)`,
                            cursor: isDragging ? 'grabbing' : 'grab',
                            whiteSpace: 'nowrap',
                            zIndex: 10
                        }}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        className="hover:scale-[1.02] transition-transform"
                    >
                        {text}
                        <div className={`absolute -inset-4 border-2 border-indigo-500/50 rounded-lg pointer-events-none transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}></div>
                    </div>
                )}
            </div>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur px-4 py-2 rounded-full text-xs text-gray-400 pointer-events-none">
                Drag text to position
            </div>
        </div>
    </div>
  );
};
