import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage, login as loginService } from '../services/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');

    if (!username || !password) {
      setError('Completá usuario y contraseña para continuar.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await loginService({ username, password });
      login(response.tokens, response.user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
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
          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
          <button disabled={loading} className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="font-medium text-slate-900">Crear cuenta</Link>
        </p>
      </div>
    </div>
  );
}
