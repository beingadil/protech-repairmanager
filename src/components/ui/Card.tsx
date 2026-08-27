import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantClasses = {
  default: 'card',
  interactive: 'card-interactive',
  flat: 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl',
} as const;

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'none',
  className = '',
  children,
  ...props
}) => {
  const paddingClasses = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }[padding];

  return (
    <div className={`${variantClasses[variant]} ${paddingClasses} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`mb-3 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`text-sm font-bold text-slate-900 dark:text-white font-heading ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-xs text-slate-500 dark:text-slate-400 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={className} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-wrap ${className}`}
    {...props}
  >
    {children}
  </div>
);

export default Card;
