import { Link } from 'react-router-dom';
import api from '../services/api';

export function RegisterPage() {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.post('/auth/register/', {
        username: form.get('username'),
        email: form.get('email'),
        password: form.get('password'),
        first_name: form.get('first_name'),
        last_name: form.get('last_name'),
      });
      window.location.href = '/login';
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Pedilo</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">Crear cuenta</h1>
          <p className="mt-2 text-sm text-slate-500">Comenzá a organizar tu menú en minutos.</p>
        </div>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Usuario</label>
            <input name="username" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" name="email" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Nombre</label>
            <input name="first_name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Apellido</label>
            <input name="last_name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Contraseña</label>
            <input type="password" name="password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </div>
          <div className="md:col-span-2">
            <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800">Crear cuenta</button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-slate-900">Ingresar</Link>
        </p>
      </div>
    </div>
  );
}
