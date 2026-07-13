import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { BusinessPage } from '../pages/BusinessPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { ProductsPage } from '../pages/ProductsPage';
import { OrdersPage } from '../pages/OrdersPage';
import { CustomersPage } from '../pages/CustomersPage';
import { PromotionsPage } from '../pages/PromotionsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Cargando Pedilo...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/registro',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'negocio', element: <BusinessPage /> },
      { path: 'categorias', element: <CategoriesPage /> },
      { path: 'productos', element: <ProductsPage /> },
      { path: 'pedidos', element: <OrdersPage /> },
      { path: 'clientes', element: <CustomersPage /> },
      { path: 'promociones', element: <PromotionsPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
