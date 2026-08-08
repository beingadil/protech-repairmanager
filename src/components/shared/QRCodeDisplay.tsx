import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  className?: string;
  bgColor?: string;
  fgColor?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 80,
  level = 'M',
  className = '',
  bgColor = '#FFFFFF',
  fgColor = '#000000'
}) => {
  return (
    <div className={`p-1.5 bg-white rounded-lg border border-slate-200 inline-block shadow-xs ${className}`}>
      <QRCodeSVG
        value={value}
        size={size}
        level={level}
        bgColor={bgColor}
        fgColor={fgColor}
        includeMargin={false}
      />
    </div>
  );
};
