import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GlobalSearch } from '../search/GlobalSearch';
import { HeaderOpportunityDropdown } from '../opportunities/HeaderOpportunityDropdown';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Menu size={18} />
          </button>
          <div className="w-[min(72vw,520px)]">
            <GlobalSearch />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <HeaderOpportunityDropdown />
          <div className="flex items-center gap-3 rounded-full border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {user?.username?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.username ?? 'Usuario'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Administrador</p>
            </div>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">Salir</button>
          </div>
        </div>
      </div>
    </header>
  );
}
