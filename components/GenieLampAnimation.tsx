import React from 'react';

// Prompts matched: bright blue genie, glowing lamp, high-contrast Disney/Tsum vibe
export const GenieLampAnimation: React.FC = () => {
  return (
    <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center select-none pointer-events-none">
      <style>{`
        @keyframes mystical-pulse {
          0% { opacity: 0.35; transform: scale(0.95); }
          50% { opacity: 0.6; transform: scale(1.05); }
          100% { opacity: 0.35; transform: scale(0.95); }
        }
      `}</style>

      {/* Dark glowing blue backdrop */}
      <div
        className="absolute inset-0 rounded-[32px] blur-[80px]"
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(59,130,246,0.35), rgba(17,24,39,0.6) 60%, rgba(0,0,0,0) 75%)',
          animation: 'mystical-pulse 8s ease-in-out infinite'
        }}
      />

      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_15px_40px_rgba(59,130,246,0.35)]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5CC4FF">
              <animate attributeName="stop-color" values="#5CC4FF;#7DD3FC;#5CC4FF" dur="7s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#1F7BFF">
              <animate attributeName="stop-color" values="#1F7BFF;#3B82F6;#1F7BFF" dur="7s" repeatCount="indefinite" />
            </stop>
          </linearGradient>

          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D">
              <animate attributeName="stop-color" values="#FCD34D;#FFEAA7;#FCD34D" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#B7791F" />
          </linearGradient>

          <radialGradient id="lampGlow" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="rgba(252,211,77,0.9)" />
            <stop offset="60%" stopColor="rgba(252,211,77,0.15)" />
            <stop offset="100%" stopColor="rgba(252,211,77,0)" />
          </radialGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="2.8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Floating group */}
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -6; 0 0" dur="4.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />

          {/* Sparkles */}
          <g fill="white" filter="url(#glow)">
            <circle cx="40" cy="140" r="1.4" opacity="0">
              <animate attributeName="opacity" values="0;1;0" dur="3.8s" begin="0s" repeatCount="indefinite" />
              <animate attributeName="cy" values="140;118" dur="3.8s" begin="0s" repeatCount="indefinite" />
              <animate attributeName="cx" values="40;35;45;40" dur="3.8s" begin="0s" repeatCount="indefinite" />
            </circle>
            <circle cx="160" cy="122" r="1.2" opacity="0">
              <animate attributeName="opacity" values="0;1;0" dur="5s" begin="0.9s" repeatCount="indefinite" />
              <animate attributeName="cy" values="122;102" dur="5s" begin="0.9s" repeatCount="indefinite" />
              <animate attributeName="cx" values="160;166;154;160" dur="5s" begin="0.9s" repeatCount="indefinite" />
            </circle>
            <circle cx="120" cy="165" r="1.3" opacity="0">
              <animate attributeName="opacity" values="0;1;0" dur="4.3s" begin="1.4s" repeatCount="indefinite" />
              <animate attributeName="cy" values="165;142" dur="4.3s" begin="1.4s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Tail / swirl */}
          <path
            fill="url(#skinGradient)"
            d="M100,190 Q80,180 75,150 Q85,118 100,118 Q115,118 125,150 Q120,180 100,190 Z"
            opacity="0.97"
          >
            <animate
              attributeName="d"
              values="M100,190 Q80,180 75,150 Q85,118 100,118 Q115,118 125,150 Q120,180 100,190 Z;
                      M100,196 Q70,176 82,152 Q90,122 100,118 Q110,122 118,152 Q130,176 100,196 Z;
                      M100,188 Q82,184 70,148 Q82,112 100,118 Q118,112 130,148 Q118,184 100,188 Z;
                      M100,190 Q80,180 75,150 Q85,118 100,118 Q115,118 125,150 Q120,180 100,190 Z"
              dur="8s"
              repeatCount="indefinite"
            />
          </path>

          {/* Body */}
          <g>
            <path d="M75,120 C65,92 70,72 100,72 C130,72 135,92 125,120 Z" fill="url(#skinGradient)" />
            {/* Red sash */}
            <path d="M72,118 Q100,126 128,118 L130,126 Q100,136 70,126 Z" fill="#E11D48" opacity="0.95">
              <animate attributeName="d" values="M72,118 Q100,126 128,118 L130,126 Q100,136 70,126 Z; M72,119 Q100,127 128,119 L130,127 Q100,137 70,127 Z; M72,118 Q100,126 128,118 L130,126 Q100,136 70,126 Z" dur="5s" repeatCount="indefinite" />
            </path>
            {/* Arms with gold armbands */}
            <path d="M70,86 C52,102 78,110 100,100" stroke="url(#skinGradient)" strokeWidth="14" strokeLinecap="round" fill="none" />
            <path d="M130,86 C148,102 122,110 100,100" stroke="url(#skinGradient)" strokeWidth="14" strokeLinecap="round" fill="none" />
            <path d="M60,96 L74,106" stroke="url(#goldGradient)" strokeWidth="7" strokeLinecap="round" />
            <path d="M126,106 L140,96" stroke="url(#goldGradient)" strokeWidth="7" strokeLinecap="round" />
          </g>

          {/* Head */}
          <g transform="translate(0, -6)">
            <animateTransform attributeName="transform" type="rotate" values="-1.5 100 55; 1.5 100 55; -1.5 100 55" dur="6s" repeatCount="indefinite" additive="sum" />
            <animateTransform attributeName="transform" type="translate" values="0 -5; 0 -2; 0 -5" dur="5.2s" repeatCount="indefinite" additive="sum" />

            <circle cx="100" cy="55" r="24" fill="url(#skinGradient)" />

            {/* Earrings */}
            <circle cx="74" cy="62" r="3.5" stroke="url(#goldGradient)" strokeWidth="2" fill="none" />
            <circle cx="126" cy="62" r="3.5" stroke="url(#goldGradient)" strokeWidth="2" fill="none" />

            <g id="face">
              <ellipse cx="90" cy="52" rx="4.2" ry="5" fill="white" />
              <ellipse cx="110" cy="52" rx="4.2" ry="5" fill="white" />
              <circle cx="90" cy="52" r="2" fill="black">
                <animate attributeName="r" values="2;2;0.1;2;2" dur="4.5s" begin="0.2s" repeatCount="indefinite" />
                <animate attributeName="cx" values="90;89;91;90" dur="8s" repeatCount="indefinite" />
              </circle>
              <circle cx="110" cy="52" r="2" fill="black">
                <animate attributeName="r" values="2;2;0.1;2;2" dur="4.5s" begin="0.2s" repeatCount="indefinite" />
                <animate attributeName="cx" values="110;111;109;110" dur="8s" repeatCount="indefinite" />
              </circle>
              {/* Handlebar mustache */}
              <path d="M88,62 Q92,58 96,62 Q100,66 104,62 Q108,58 112,62" stroke="#0F172A" strokeWidth="3" fill="none" strokeLinecap="round" />
              {/* Smile */}
              <path d="M92,70 Q100,76 108,70" stroke="#0B2B75" strokeWidth="2.5" fill="none" strokeLinecap="round">
                <animate attributeName="d" values="M92,70 Q100,76 108,70; M92,71 Q100,77 108,71; M92,70 Q100,76 108,70" dur="7s" repeatCount="indefinite" />
              </path>
              {/* Nose + glow hint */}
              <path d="M100,54 Q98,60 100,60" stroke="#0EA5E9" strokeWidth="1.2" fill="none" opacity="0.7" />
            </g>

            {/* Topknot */}
            <path d="M85,36 Q100,18 115,36" fill="#0EA5E9" />
            <circle cx="100" cy="28" r="6" fill="url(#goldGradient)" stroke="#B7791F" strokeWidth="1" />
            <circle cx="100" cy="28" r="3" fill="#EF4444">
              <animate attributeName="fill" values="#EF4444;#FB7185;#EF4444" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        </g>

        {/* Lamp with glow + sparks */}
        <g transform="translate(0, 4)">
          <circle cx="100" cy="178" r="34" fill="url(#lampGlow)" opacity="0.65" />
          <path
            d="M70,175 Q100,168 125,176 L138,174 Q142,174 142,178 Q142,182 138,182 L124,182 Q104,192 86,186 Q76,182 70,175 Z"
            fill="url(#goldGradient)"
            stroke="#B7791F"
            strokeWidth="1"
            filter="url(#glow)"
          />
          <path d="M138,174 Q150,170 152,176 Q154,182 144,182" fill="url(#goldGradient)" stroke="#B7791F" strokeWidth="1" />
          <circle cx="84" cy="177" r="3" fill="#F59E0B" opacity="0.9" />
          <path d="M96,172 Q100,168 104,172" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
          {/* Spark burst from lamp */}
          <g stroke="#FCD34D" strokeWidth="1.5" opacity="0.8">
            <line x1="100" y1="165" x2="100" y2="150">
              <animate attributeName="y2" values="150;140;150" dur="2.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;1;0.4" dur="2.8s" repeatCount="indefinite" />
            </line>
            <line x1="94" y1="167" x2="86" y2="156">
              <animate attributeName="y2" values="156;148;156" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
            </line>
            <line x1="106" y1="167" x2="114" y2="156">
              <animate attributeName="y2" values="156;146;156" dur="2.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;1;0.4" dur="2.6s" repeatCount="indefinite" />
            </line>
          </g>
        </g>
      </svg>
    </div>
  );
};