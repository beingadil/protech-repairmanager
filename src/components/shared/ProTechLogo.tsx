import React from 'react';

interface ProTechLogoProps {
  className?: string;
  size?: number;
}

export const ProTechLogo: React.FC<ProTechLogoProps> = ({ className = 'w-9 h-9', size }) => {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <svg
      viewBox="0 0 100 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 drop-shadow-xs`}
      style={style}
    >
      <defs>
        {/* Metallic Blue Shield Gradient */}
        <linearGradient id="protechShieldBg" x1="50" y1="5" x2="50" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e68d0" />
          <stop offset="45%" stopColor="#0f4fa8" />
          <stop offset="100%" stopColor="#082b68" />
        </linearGradient>

        {/* Metallic Silver Frame Gradient */}
        <linearGradient id="protechSilverBorder" x1="0" y1="0" x2="100" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#d1d5db" />
          <stop offset="70%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#f3f4f6" />
        </linearGradient>

        {/* Lock Emblem Silver Glow/Gradient */}
        <linearGradient id="protechLockSilver" x1="20" y1="20" x2="80" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Subtle Drop Shadow */}
        <filter id="shieldShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Main Outer Shield Path */}
      <path
        d="M 50 6 C 78 6, 92 14, 92 48 C 92 76, 70 94, 50 104 C 30 94, 8 76, 8 48 C 8 14, 22 6, 50 6 Z"
        fill="url(#protechShieldBg)"
        stroke="url(#protechSilverBorder)"
        strokeWidth="4"
        strokeLinejoin="round"
        filter="url(#shieldShadow)"
      />

      {/* Inner Metallic Border Line */}
      <path
        d="M 50 10 C 74 10, 87 17, 87 48 C 87 72, 67 89, 50 98 C 33 89, 13 72, 13 48 C 13 17, 26 10, 50 10 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="1.2"
      />

      {/* Lock Shackle (Top Arc) */}
      <path
        d="M 34,44 V 31 C 34,20 66,20 66,31 V 44"
        fill="none"
        stroke="url(#protechLockSilver)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* Main Circuit Lock Body Outer Frame */}
      <path
        d="M 30,44 H 70 V 62 C 70 73, 50 83, 50 83 C 50 83, 30 73, 30 62 Z"
        fill="none"
        stroke="url(#protechLockSilver)"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Circuit Nodes & Lines inside Lock Body */}
      {/* Left Node Trace */}
      <path
        d="M 42 52 V 67 M 42 59 H 52"
        fill="none"
        stroke="url(#protechLockSilver)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Node Dots on Left Trace */}
      <circle cx="42" cy="52" r="3.2" fill="url(#protechLockSilver)" />
      <circle cx="42" cy="67" r="3.2" fill="url(#protechLockSilver)" />
      <circle cx="52" cy="59" r="3.2" fill="url(#protechLockSilver)" />

      {/* Right Bottom Curved Node Trace */}
      <path
        d="M 45 77 C 50 77, 58 74, 58 67"
        fill="none"
        stroke="url(#protechLockSilver)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Node Dot on Right Trace */}
      <circle cx="58" cy="67" r="3.2" fill="url(#protechLockSilver)" />
    </svg>
  );
};
