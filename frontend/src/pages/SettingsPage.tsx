import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { getBusinessSchedules, getBusinessSettings, updateBusinessSchedules, updateBusinessSettings, type BusinessSchedule, type BusinessSettings } from '../services/settings';

const days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

function money(value: string | null | undefined) {
  return value ?? '';
}

export function SettingsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [schedules, setSchedules] = useState<BusinessSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async (id?: number) => {
    try {
      setLoading(true);
      setError('');
      const businessResponse = businesses.length ? businesses : await getBusinesses();
      if (!businesses.length) setBusinesses(businessResponse);
      const selectedId = id ?? businessResponse.find((business) => business.active)?.id ?? businessResponse[0]?.id ?? null;
      setBusinessId(selectedId);
      if (selectedId) {
        const [settingsResponse, schedulesResponse] = await Promise.all([getBusinessSettings(selectedId), getBusinessSchedules(selectedId)]);
        setSettings(settingsResponse);
        setSchedules(schedulesResponse);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar la configuracion.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateField = (field: keyof BusinessSettings, value: string | boolean | number | null) => {
    setSettings((current) => current ? { ...current, [field]: value } : current);
  };

  const updateSchedule = (weekday: number, patch: Partial<BusinessSchedule>) => {
    setSchedules((current) => current.map((schedule) => schedule.weekday === weekday ? { ...schedule, ...patch } : schedule));
  };

  const handleSave = async () => {
    if (!businessId || !settings) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = {
        ...settings,
        free_delivery_from: settings.free_delivery_from || null,
        estimated_delivery_minutes: settings.estimated_delivery_minutes || null,
        estimated_pickup_minutes: settings.estimated_pickup_minutes || null,
      };
      const cleanSchedules = schedules.map((schedule) => ({
        weekday: schedule.weekday,
        is_closed: schedule.is_closed,
        opening_time: schedule.is_closed ? null : schedule.opening_time,
        closing_time: schedule.is_closed ? null : schedule.closing_time,
      }));
      const [savedSettings, savedSchedules] = await Promise.all([updateBusinessSettings(businessId, payload), updateBusinessSchedules(businessId, cleanSchedules)]);
      setSettings(savedSettings);
      setSchedules(savedSchedules);
      setMessage('Configuracion guardada correctamente.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos guardar la configuracion.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-4"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Configuracion</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Ajustes operativos</h1>
          <p className="mt-2 text-sm text-slate-500">Reglas para recibir, validar y gestionar pedidos.</p>
        </div>
        {businesses.length > 1 ? <select value={businessId ?? ''} onChange={(event) => void load(Number(event.target.value))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select> : null}
      </div>
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {settings ? (
        <>
          <Card title="Pedidos">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Recibir pedidos<input type="checkbox" checked={settings.orders_enabled} onChange={(event) => updateField('orders_enabled', event.target.checked)} /></label>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Fuera de horario<input type="checkbox" checked={settings.accept_orders_when_closed} onChange={(event) => updateField('accept_orders_when_closed', event.target.checked)} /></label>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Aceptacion automatica<input type="checkbox" checked={settings.automatic_order_acceptance} onChange={(event) => updateField('automatic_order_acceptance', event.target.checked)} /></label>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Impedir ventas sin stock<input type="checkbox" checked={settings.prevent_sales_without_stock} onChange={(event) => updateField('prevent_sales_without_stock', event.target.checked)} /></label>
            </div>
            <p className="mt-3 text-sm text-slate-500">Cuando esta activo, Pedilo rechazara pedidos que no puedan prepararse con el inventario disponible.</p>
          </Card>
          <Card title="Entrega">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Delivery<input type="checkbox" checked={settings.delivery_enabled} onChange={(event) => updateField('delivery_enabled', event.target.checked)} /></label>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Retiro<input type="checkbox" checked={settings.pickup_enabled} onChange={(event) => updateField('pickup_enabled', event.target.checked)} /></label>
              <input value={money(settings.minimum_order)} onChange={(event) => updateField('minimum_order', event.target.value)} placeholder="Pedido minimo" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <input value={money(settings.delivery_fee)} onChange={(event) => updateField('delivery_fee', event.target.value)} placeholder="Costo envio" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <input value={money(settings.free_delivery_from)} onChange={(event) => updateField('free_delivery_from', event.target.value)} placeholder="Envio gratis desde" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <input value={settings.estimated_delivery_minutes ?? ''} onChange={(event) => updateField('estimated_delivery_minutes', event.target.value ? Number(event.target.value) : null)} placeholder="Min envio" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <input value={settings.estimated_pickup_minutes ?? ''} onChange={(event) => updateField('estimated_pickup_minutes', event.target.value ? Number(event.target.value) : null)} placeholder="Min retiro" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            </div>
          </Card>
          <Card title="Datos solicitados">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Telefono obligatorio<input type="checkbox" checked={settings.require_customer_phone} onChange={(event) => updateField('require_customer_phone', event.target.checked)} /></label>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Direccion para delivery<input type="checkbox" checked={settings.require_delivery_address} onChange={(event) => updateField('require_delivery_address', event.target.checked)} /></label>
            </div>
          </Card>
          <Card title="WhatsApp">
            <div className="space-y-3"><input value={settings.whatsapp_number} onChange={(event) => updateField('whatsapp_number', event.target.value)} placeholder="Numero WhatsApp" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" /><textarea value={settings.whatsapp_message_template} onChange={(event) => updateField('whatsapp_message_template', event.target.value)} placeholder="Plantilla del mensaje" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" /></div>
          </Card>
          <Card title="Menu">
            <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">Mostrar agotados<input type="checkbox" checked={settings.show_out_of_stock_products} onChange={(event) => updateField('show_out_of_stock_products', event.target.checked)} /></label>
          </Card>
          <Card title="Horarios">
            <div className="space-y-3">
              {days.map((day, index) => {
                const schedule = schedules.find((item) => item.weekday === index) ?? { weekday: index, is_closed: true, opening_time: null, closing_time: null };
                return <div key={day} className="grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_120px_1fr_1fr]"><p className="font-medium text-slate-800">{day}</p><label className="text-sm">Cerrado <input type="checkbox" checked={schedule.is_closed} onChange={(event) => updateSchedule(index, { is_closed: event.target.checked })} /></label><input type="time" disabled={schedule.is_closed} value={schedule.opening_time ?? ''} onChange={(event) => updateSchedule(index, { opening_time: event.target.value })} className="rounded-xl border px-3 py-2" /><input type="time" disabled={schedule.is_closed} value={schedule.closing_time ?? ''} onChange={(event) => updateSchedule(index, { closing_time: event.target.value })} className="rounded-xl border px-3 py-2" /></div>;
              })}
            </div>
          </Card>
          <div className="flex justify-end"><button disabled={saving} onClick={() => void handleSave()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}Guardar ajustes</button></div>
        </>
      ) : null}
    </div>
  );
}
