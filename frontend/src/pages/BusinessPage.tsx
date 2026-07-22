import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, Loader2, Save, Store } from 'lucide-react';
import { ShareMenuCard } from '../components/business/ShareMenuCard';
import { Card } from '../components/ui/Card';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, updateBusiness, type Business } from '../services/business';

interface BusinessFormState {
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  opening_hours: string;
  instagram: string;
  facebook: string;
  primary_color: string;
}

const initialForm: BusinessFormState = {
  name: '',
  description: '',
  phone: '',
  email: '',
  address: '',
  opening_hours: '',
  instagram: '',
  facebook: '',
  primary_color: '#0f172a',
};

function toFormState(business: Business): BusinessFormState {
  return {
    name: business.name ?? '',
    description: business.description ?? '',
    phone: business.phone ?? '',
    email: business.email ?? '',
    address: business.address ?? '',
    opening_hours: business.opening_hours ?? '',
    instagram: business.instagram ?? '',
    facebook: business.facebook ?? '',
    primary_color: business.primary_color ?? '#0f172a',
  };
}

function ImagePicker({
  label,
  currentUrl,
  previewUrl,
  onChange,
}: {
  label: string;
  currentUrl?: string | null;
  previewUrl: string;
  onChange: (file: File | null) => void;
}) {
  const imageUrl = previewUrl || currentUrl || '';

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onChange(file);
  };

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-slate-400">
          {imageUrl ? <img src={imageUrl} alt={label} className="h-full w-full object-cover" /> : <ImagePlus size={24} />}
        </div>
        <div className="min-w-0 flex-1">
          <input type="file" accept="image/*" onChange={handleChange} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
          <p className="mt-2 text-xs text-slate-500">Si no elegis una imagen nueva, se conserva la actual.</p>
        </div>
      </div>
    </label>
  );
}

export function BusinessPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState<BusinessFormState>(initialForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ''), [logoFile]);
  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : ''), [coverFile]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [logoPreview, coverPreview]);

  useEffect(() => {
    let mounted = true;

    async function loadBusiness() {
      try {
        setLoading(true);
        const businesses = await getBusinesses();
        const activeBusiness = businesses.find((item) => item.active) ?? businesses[0] ?? null;
        if (!mounted) return;
        setBusiness(activeBusiness);
        if (activeBusiness) {
          setForm(toFormState(activeBusiness));
        }
      } catch (requestError) {
        if (mounted) {
          setError(getApiErrorMessage(requestError, 'No pudimos cargar los datos del negocio.'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadBusiness();

    return () => {
      mounted = false;
    };
  }, []);

  const handleFieldChange = (field: keyof BusinessFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleImageChange = (type: 'logo' | 'cover', file: File | null) => {
    setError('');
    if (file && !file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen.');
      return;
    }

    if (type === 'logo') {
      setLogoFile(file);
    } else {
      setCoverFile(file);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!business) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const updated = await updateBusiness(business.id, {
        ...form,
        logo: logoFile,
        cover_image: coverFile,
      });
      setBusiness(updated);
      setForm(toFormState(updated));
      setLogoFile(null);
      setCoverFile(null);
      setSuccess('Negocio actualizado correctamente.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos guardar los cambios del negocio.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Negocio</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Mi negocio</h1>
        </div>
        <Card>
          <div className="py-8 text-center">
            <Store className="mx-auto text-slate-400" size={34} />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Todavia no tenes un negocio creado</h2>
            <p className="mt-2 text-sm text-slate-500">Crealo desde el dashboard para poder personalizar el menu publico.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Negocio</p>
        <h1 className="text-3xl font-semibold text-slate-900">Mi negocio</h1>
        <p className="text-sm text-slate-500">Edita la informacion y apariencia basica de tu menu publico.</p>
      </div>

      <ShareMenuCard businessId={business.id} businessName={business.name} />

      <Card>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
          {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Nombre comercial</span>
              <input value={form.name} onChange={(event) => handleFieldChange('name', event.target.value)} placeholder="Ej. La Esquina del Pan" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" required />
              <span className="mt-1 block text-xs text-slate-500">Es el nombre que tus clientes veran en el menu publico.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Email de contacto</span>
              <input type="email" value={form.email} onChange={(event) => handleFieldChange('email', event.target.value)} placeholder="Ej. pedidos@minegocio.com" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" required />
              <span className="mt-1 block text-xs text-slate-500">Usalo para contacto administrativo o consultas del cliente.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Telefono visible para clientes</span>
              <input value={form.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} placeholder="Ej. 11 5555-1234" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
              <span className="mt-1 block text-xs text-slate-500">Tambien puede usarse como numero de contacto del menu.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Color principal del menu</span>
              <div className="flex gap-3">
                <input type="color" value={form.primary_color} onChange={(event) => handleFieldChange('primary_color', event.target.value)} className="h-12 w-14 rounded-2xl border border-slate-200 bg-white p-1" />
                <input value={form.primary_color} onChange={(event) => handleFieldChange('primary_color', event.target.value)} placeholder="Ej. #0f172a" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
              </div>
              <span className="mt-1 block text-xs text-slate-500">Pedilo lo aplica en botones y detalles visuales del menu publico.</span>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Descripcion breve del negocio</span>
            <textarea value={form.description} onChange={(event) => handleFieldChange('description', event.target.value)} rows={4} placeholder="Ej. Panaderia artesanal, desayunos y almuerzos caseros todos los dias." className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
            <span className="mt-1 block text-xs text-slate-500">Una frase simple ayuda a que el cliente entienda que vendes y por que elegirte.</span>
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Direccion del local</span>
              <input value={form.address} onChange={(event) => handleFieldChange('address', event.target.value)} placeholder="Ej. Av. Corrientes 1234, CABA" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
              <span className="mt-1 block text-xs text-slate-500">Se muestra en el menu para retiro o referencia de zona.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Horarios visibles</span>
              <input value={form.opening_hours} onChange={(event) => handleFieldChange('opening_hours', event.target.value)} placeholder="Ej. Lunes a sabado de 9 a 21 hs" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
              <span className="mt-1 block text-xs text-slate-500">Texto libre para orientar al cliente; las reglas operativas se configuran aparte.</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Instagram</span>
              <input type="url" value={form.instagram} onChange={(event) => handleFieldChange('instagram', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" placeholder="https://instagram.com/tu-negocio" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Facebook</span>
              <input type="url" value={form.facebook} onChange={(event) => handleFieldChange('facebook', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" placeholder="https://facebook.com/tu-negocio" />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ImagePicker label="Logo" currentUrl={business.logo} previewUrl={logoPreview} onChange={(file) => handleImageChange('logo', file)} />
            <ImagePicker label="Portada" currentUrl={business.cover_image} previewUrl={coverPreview} onChange={(file) => handleImageChange('cover', file)} />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
