import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, description, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
