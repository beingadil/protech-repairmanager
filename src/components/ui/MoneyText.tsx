import React from 'react';
import { formatCurrency } from '../../lib/utils';

/**
 * Right-aligned tabular money display. Replaces ad-hoc
 * `formatCurrency(...)` + font-bold + text-right chains scattered through
 * tables. `tone` optionally colors inflow/outflow; default stays neutral.
 */
interface MoneyTextProps {
  amount: number | string | null | undefined;
  tone?: 'neutral' | 'positive' | 'negative' | 'auto';
  signed?: boolean;
  className?: string;
  bold?: boolean;
}

const toneClasses: Record<'positive' | 'negative', string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-600 dark:text-rose-400'
};

export const MoneyText: React.FC<MoneyTextProps> = ({
  amount,
  tone = 'neutral',
  signed = false,
  className = '',
  bold = false
}) => {
  const n = Number(amount) || 0;
  let cls = '';

  if (tone === 'positive') cls = toneClasses.positive;
  else if (tone === 'negative') cls = toneClasses.negative;
  else if (tone === 'auto') {
    cls = n > 0 ? toneClasses.positive : n < 0 ? toneClasses.negative : '';
  }

  const label = signed && n > 0 ? `+${formatCurrency(n)}` : formatCurrency(n);

  return (
    <span
      className={`tabular-nums whitespace-nowrap ${bold ? 'font-bold' : 'font-semibold'} ${cls} ${className}`}
    >
      {label}
    </span>
  );
};

export default MoneyText;
