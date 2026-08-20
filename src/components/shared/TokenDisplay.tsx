import React from 'react';
import { Tag } from 'lucide-react';

interface TokenDisplayProps {
  token: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  token,
  size = 'md',
  showIcon = true
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 tracking-wider font-mono',
    md: 'text-sm px-2.5 py-1 tracking-widest font-mono font-bold',
    lg: 'text-lg px-4 py-1.5 tracking-widest font-mono font-black'
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-xs ${sizeClasses}`}>
      {showIcon && <Tag className="w-3.5 h-3.5 text-slate-500" />}
      {token}
    </span>
  );
};
