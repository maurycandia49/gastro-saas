import { Boxes, ChevronLeft, ChevronRight, LayoutDashboard, ReceiptText, Settings, Sparkles, Store, Tag, TrendingUp, Users, Warehouse } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/negocio', label: 'Mi negocio', icon: Store },
  { to: '/categorias', label: 'Categorias', icon: Tag },
  { to: '/productos', label: 'Productos', icon: Boxes },
  { to: '/pedidos', label: 'Pedidos', icon: ReceiptText },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/promociones', label: 'Promociones', icon: Sparkles },
  { to: '/inventario', label: 'Inventario', icon: Warehouse },
  { to: '/costos', label: 'Costos y margenes', icon: TrendingUp },
  { to: '/configuracion', label: 'Configuracion', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`hidden border-r border-slate-200 bg-white/80 backdrop-blur lg:flex lg:flex-col ${collapsed ? 'w-20' : 'w-72'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">P</div>
          {!collapsed && <div><p className="font-semibold text-slate-900">Pedilo</p><p className="text-sm text-slate-500">SaaS gastronomico</p></div>}
        </div>
        <button onClick={onToggle} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
