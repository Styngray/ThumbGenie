import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';

interface RegionEditToolProps {
  imageSrc: string;
  onApply: (prompt: string, coords: string) => void;
  onCancel: () => void;
}

export const RegionEditTool: React.FC<RegionEditToolProps> = ({ imageSrc, onApply, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [prompt, setPrompt] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Optional: Initial center crop or just let user draw
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedCrop || !imgRef.current || !prompt.trim()) return;

    const image = imgRef.current;
    
    // Convert to normalized coordinates (0-1000 scale) which is standard for Gemini/LLMs
    // Format: [ymin, xmin, ymax, xmax]
    const scaleY = 1000 / image.height;
    const scaleX = 1000 / image.width;

    const ymin = Math.floor(completedCrop.y * scaleY);
    const xmin = Math.floor(completedCrop.x * scaleX);
    const ymax = Math.floor((completedCrop.y + completedCrop.height) * scaleY);
    const xmax = Math.floor((completedCrop.x + completedCrop.width) * scaleX);

    const coordString = `[${ymin}, ${xmin}, ${ymax}, ${xmax}]`;
    onApply(prompt.trim(), coordString);
  };

  // Calculate position for the floating input box
  const getInputPosition = () => {
    if (!completedCrop || !imgRef.current) return {};
    
    // Position below the crop area, but keep within screen bounds
    const imgRect = imgRef.current.getBoundingClientRect();
    const topOffset = imgRect.top + completedCrop.y + completedCrop.height + 10;
    const leftOffset = imgRect.left + completedCrop.x + (completedCrop.width / 2);
    
    return {
        top: Math.min(topOffset, window.innerHeight - 80), // Prevent going off bottom
        left: Math.max(20, Math.min(leftOffset, window.innerWidth - 20)), // Prevent going off sides
        transform: 'translateX(-50%)'
    };
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-[#121212] border-b border-white/10 flex justify-between items-center z-50">
        <h3 className="text-white font-medium flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Edit Region
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-sm">
          Cancel
        </button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden">
        {/* Helper Text */}
        {!completedCrop?.width && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-none">
                <p className="text-white text-sm font-medium">Draw a box to edit a specific area</p>
            </div>
        )}

        <ReactCrop 
            crop={crop} 
            onChange={(c) => setCrop(c)} 
            onComplete={(c) => setCompletedCrop(c)}
            className="max-h-[80vh] region-crop-custom"
        >
            <img 
              ref={imgRef}
              src={imageSrc} 
              onLoad={onImageLoad}
              className="max-h-[80vh] max-w-full object-contain"
              draggable={false}
              alt="Edit Region"
            />
        </ReactCrop>

        {/* Floating Input Bar */}
        {completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && (
            <form 
                onSubmit={handleSubmit}
                style={{ 
                    position: 'fixed', 
                    ...getInputPosition(),
                    zIndex: 100 
                }}
                className="flex items-center gap-2 bg-[#1a1a1c] p-1.5 rounded-xl border border-white/10 shadow-2xl min-w-[300px] animate-in slide-in-from-top-2 duration-200"
            >
                <input 
                    autoFocus
                    type="text" 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g., Make this blue..."
                    className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm px-3 py-2 outline-none"
                />
                <button 
                    type="submit"
                    className="p-2 bg-green-600 hover:bg-green-500 text-black rounded-lg transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                </button>
            </form>
        )}
      </div>

      <style>{`
        .region-crop-custom .ReactCrop__crop-selection {
            border: 2px solid #4ade80 !important; /* Green border */
            box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.6);
        }
        .region-crop-custom .ReactCrop__drag-handle::after {
            background-color: #4ade80 !important;
        }
      `}</style>
    </div>
  );
};