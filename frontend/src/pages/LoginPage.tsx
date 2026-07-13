import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export function LoginPage() {
  const { login } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await api.post('/auth/login/', {
        username: form.get('username'),
        password: form.get('password'),
      });
      login(response.data, {
        id: 0,
        username: form.get('username') as string,
        email: `${form.get('username')}@pedilo.local`,
      });
      window.location.href = '/dashboard';
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Pedilo</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">Ingresar</h1>
          <p className="mt-2 text-sm text-slate-500">Gestioná tu negocio con una experiencia simple y elegante.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Usuario</label>
            <input name="username" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-0" placeholder="usuario" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Contraseña</label>
            <input type="password" name="password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-0" placeholder="••••••••" />
          </div>
          <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800">Entrar</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="font-medium text-slate-900">Crear cuenta</Link>
        </p>
      </div>
    </div>
  );
}
