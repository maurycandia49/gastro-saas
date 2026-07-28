import { Camera, UploadCloud } from 'lucide-react';

interface Props {
  disabled?: boolean;
  onScan: (file: File) => void;
}

export function InvoiceScanner({ disabled, onScan }: Props) {
  return (
    <label className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:bg-slate-100 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Camera size={18} /> Escanear factura</div>
      <UploadCloud className="mt-3 text-slate-400" size={26} />
      <p className="mt-2 text-xs text-slate-500">Cámara, galería o arrastrar archivo. No confirma stock automáticamente.</p>
      <input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) onScan(file); event.target.value = ''; }} className="hidden" />
    </label>
  );
}
