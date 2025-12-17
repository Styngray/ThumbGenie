import React from 'react';

export const GenieLampAnimation: React.FC = () => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center select-none pointer-events-none">
      {/* Mystical Glow Background - Dynamic Color Shift & Pulse */}
      <style>{`
        @keyframes mystical-pulse {
          0% { opacity: 0.4; filter: hue-rotate(0deg) scale(0.9); }
          33% { opacity: 0.6; filter: hue-rotate(20deg) scale(1.05); }
          66% { opacity: 0.5; filter: hue-rotate(-20deg) scale(0.95); }
          100% { opacity: 0.4; filter: hue-rotate(0deg) scale(0.9); }
        }
      `}</style>
      <div className="absolute w-48 h-48 blur-[60px] rounded-full"
           style={{
             background: 'radial-gradient(circle, rgba(99,102,241,0.6) 0%, rgba(168,85,247,0.3) 50%, rgba(0,0,0,0) 70%)',
             animation: 'mystical-pulse 11s ease-in-out infinite'
           }}
      />

      <svg 
        viewBox="0 0 200 200" 
        className="w-full h-full drop-shadow-2xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA">
               <animate attributeName="stop-color" values="#60A5FA;#93C5FD;#60A5FA" dur="7s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#2563EB">
               <animate attributeName="stop-color" values="#2563EB;#3B82F6;#2563EB" dur="7s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D">
                <animate attributeName="stop-color" values="#FCD34D;#FEF3C7;#FCD34D" dur="5s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          <filter id="glow">
             <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
             <feMerge>
                 <feMergeNode in="coloredBlur"/>
                 <feMergeNode in="SourceGraphic"/>
             </feMerge>
          </filter>
        </defs>

        {/* Floating Animation Group - Replaces CSS animation for smoother control */}
        <g>
             <animateTransform attributeName="transform" type="translate" values="0 0; 0 -8; 0 0" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
             
             {/* Magical Sparkles with spiral/random motion */}
            <g fill="white" filter="url(#glow)">
                <circle cx="40" cy="140" r="1.5" opacity="0">
                    <animate attributeName="opacity" values="0;1;0" dur="4s" begin="0s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="140;120" dur="4s" begin="0s" repeatCount="indefinite" />
                    <animate attributeName="cx" values="40;35;45;40" dur="4s" begin="0s" repeatCount="indefinite" />
                </circle>
                <circle cx="160" cy="120" r="1" opacity="0">
                    <animate attributeName="opacity" values="0;1;0" dur="5.3s" begin="1s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="120;100" dur="5.3s" begin="1s" repeatCount="indefinite" />
                    <animate attributeName="cx" values="160;165;155;160" dur="5.3s" begin="1s" repeatCount="indefinite" />
                </circle>
                <circle cx="140" cy="160" r="1.2" opacity="0">
                    <animate attributeName="opacity" values="0;1;0" dur="3.7s" begin="2s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="160;140" dur="3.7s" begin="2s" repeatCount="indefinite" />
                </circle>
            </g>

            {/* Smoke Tail */}
            <path 
            fill="url(#skinGradient)" 
            d="M100,190 Q80,180 75,150 Q85,120 100,120 Q115,120 125,150 Q120,180 100,190 Z"
            opacity="0.95"
            >
            <animate 
                attributeName="d" 
                values="M100,190 Q80,180 75,150 Q85,120 100,120 Q115,120 125,150 Q120,180 100,190 Z;
                        M100,195 Q70,175 80,155 Q90,125 100,120 Q110,125 120,155 Q130,175 100,195 Z;
                        M100,190 Q85,185 70,150 Q80,115 100,120 Q120,115 130,150 Q115,185 100,190 Z;
                        M100,190 Q80,180 75,150 Q85,120 100,120 Q115,120 125,150 Q120,180 100,190 Z"
                dur="8s" 
                repeatCount="indefinite" 
            />
            </path>

            {/* Body Group */}
            <g>
                <path d="M75,120 C65,90 70,70 100,70 C130,70 135,90 125,120 Z" fill="url(#skinGradient)" />
                {/* Vest Breathing */}
                <path d="M72,120 Q65,90 75,70 L85,75 Q80,95 85,120 Z" fill="#4C1D95">
                    <animate attributeName="d" values="M72,120 Q65,90 75,70 L85,75 Q80,95 85,120 Z; M71,121 Q63,90 74,70 L84,75 Q79,95 84,121 Z; M72,120 Q65,90 75,70 L85,75 Q80,95 85,120 Z" dur="5s" repeatCount="indefinite" />
                </path>
                <path d="M128,120 Q135,90 125,70 L115,75 Q120,95 115,120 Z" fill="#4C1D95">
                    <animate attributeName="d" values="M128,120 Q135,90 125,70 L115,75 Q120,95 115,120 Z; M129,121 Q137,90 126,70 L116,75 Q121,95 116,121 Z; M128,120 Q135,90 125,70 L115,75 Q120,95 115,120 Z" dur="5s" repeatCount="indefinite" />
                </path>
                {/* Arms */}
                <path d="M70,85 C55,100 80,110 100,100" stroke="url(#skinGradient)" strokeWidth="14" strokeLinecap="round" fill="none" />
                <path d="M130,85 C145,100 120,110 100,100" stroke="url(#skinGradient)" strokeWidth="14" strokeLinecap="round" fill="none" />
                {/* Cuffs */}
                <path d="M63,95 L73,105" stroke="url(#goldGradient)" strokeWidth="6" strokeLinecap="round" />
                <path d="M127,105 L137,95" stroke="url(#goldGradient)" strokeWidth="6" strokeLinecap="round" />
            </g>

            {/* Head Group - Decoupled motion */}
            <g transform="translate(0, -5)">
                <animateTransform attributeName="transform" type="rotate" values="-1.5 100 55; 1.5 100 55; -1.5 100 55" dur="6.5s" repeatCount="indefinite" additive="sum" />
                <animateTransform attributeName="transform" type="translate" values="0 -5; 0 -2; 0 -5" dur="5.5s" repeatCount="indefinite" additive="sum" />

                <circle cx="100" cy="55" r="24" fill="url(#skinGradient)" />
                <path d="M100,79 L95,88 L100,92 L105,88 Z" fill="#1E3A8A" />
                <circle cx="76" cy="55" r="5" fill="url(#skinGradient)" />
                <circle cx="124" cy="55" r="5" fill="url(#skinGradient)" />
                <circle cx="74" cy="62" r="2" fill="#FCD34D" />
                <circle cx="126" cy="62" r="2" fill="#FCD34D" />

                <g id="face">
                    <ellipse cx="90" cy="52" rx="4" ry="5" fill="white" />
                    <ellipse cx="110" cy="52" rx="4" ry="5" fill="white" />
                    <circle cx="90" cy="52" r="2" fill="black">
                        <animate attributeName="r" values="2;2;0.1;2;2;2;2" dur="4.5s" begin="0.2s" repeatCount="indefinite" />
                        <animate attributeName="cx" values="90;89;91;90;90" dur="9s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="110" cy="52" r="2" fill="black">
                        <animate attributeName="r" values="2;2;0.1;2;2;2;2" dur="4.5s" begin="0.2s" repeatCount="indefinite" />
                        <animate attributeName="cx" values="110;109;111;110;110" dur="9s" repeatCount="indefinite" />
                    </circle>
                    <path d="M84,45 Q90,38 96,45" stroke="#1E3A8A" strokeWidth="2.5" fill="none" strokeLinecap="round">
                        <animate attributeName="d" values="M84,45 Q90,38 96,45; M84,43 Q90,36 96,43; M84,45 Q90,38 96,45" dur="7s" repeatCount="indefinite" />
                    </path>
                    <path d="M104,45 Q110,38 116,45" stroke="#1E3A8A" strokeWidth="2.5" fill="none" strokeLinecap="round">
                        <animate attributeName="d" values="M104,45 Q110,38 116,45; M104,43 Q110,36 116,43; M104,45 Q110,38 116,45" dur="7s" repeatCount="indefinite" />
                    </path>
                    <path d="M100,52 Q96,60 100,62" stroke="#1E40AF" strokeWidth="1" fill="none" opacity="0.4" />
                    {/* Smile Animation */}
                    <path d="M92,68 Q100,74 108,68" stroke="#1E3A8A" strokeWidth="2" fill="none" strokeLinecap="round">
                        <animate attributeName="d" values="M92,68 Q100,74 108,68; M92,69 Q100,75 108,69; M92,68 Q100,74 108,68" dur="8s" repeatCount="indefinite" />
                    </path>
                </g>

                <path d="M75,40 Q100,10 125,40" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
                <path d="M78,38 Q100,20 122,38" fill="white" />
                <circle cx="100" cy="30" r="6" fill="url(#goldGradient)" stroke="#B45309" strokeWidth="1" />
                <circle cx="100" cy="30" r="3" fill="#EF4444">
                    <animate attributeName="fill" values="#EF4444;#F87171;#EF4444" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="100" cy="30" r="1" fill="white" opacity="0.6" />
            </g>
        </g>
      </svg>
    </div>
  );
};