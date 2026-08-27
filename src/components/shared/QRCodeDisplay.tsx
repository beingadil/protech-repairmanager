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

/**
 * Inline-styled QR block. Deliberately avoids Tailwind utility classes: this
 * component is also rendered into STANDALONE print documents via
 * renderToStaticMarkup (see src/lib/print-document.ts), where the app CSS
 * bundle does not exist. Inline styles survive everywhere.
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 80,
  level = 'M',
  className = '',
  bgColor = '#FFFFFF',
  fgColor = '#000000'
}) => {
  return (
    <div
      className={className}
      style={{
        padding: '6px',
        backgroundColor: bgColor,
        borderRadius: '8px',
        display: 'inline-block'
      }}
    >
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
