import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header onMenuToggle={() => setCollapsed((value) => !value)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
