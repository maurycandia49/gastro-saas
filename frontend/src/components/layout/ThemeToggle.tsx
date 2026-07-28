import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme, type Theme } from '../../contexts/ThemeContext';

const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const CurrentIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={`Cambiar tema. Tema actual: ${theme}`}
        title="Cambiar tema"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CurrentIcon size={18} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 ${theme === value ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
