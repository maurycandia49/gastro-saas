import { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { QRCard } from './QRCard';

interface ShareMenuCardProps {
  businessId: number;
  businessName: string;
}

function getPublicMenuUrl(businessId: number) {
  return `${window.location.origin}/menu/${businessId}`;
}

export function ShareMenuCard({ businessId, businessName }: ShareMenuCardProps) {
  const menuUrl = useMemo(() => getPublicMenuUrl(businessId), [businessId]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2400);
  };

  const handleQrReady = useCallback((dataUrl: string) => {
    setQrDataUrl(dataUrl);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(menuUrl);
    showMessage('Enlace copiado.');
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    setDownloading(true);

    window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `pedilo-menu-${businessId}.png`;
      link.click();
      setDownloading(false);
    }, 350);
  };

  return (
    <Card title="Mi menu publico" description="Compartilo con tus clientes desde el local, redes sociales o WhatsApp.">
      <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0 space-y-4">
          {message ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <Check size={17} />
              {message}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">URL publica</p>
            <p className="mt-2 break-all text-sm font-medium text-slate-900">{menuUrl}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={() => void handleCopy()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              <Copy size={17} />
              Copiar enlace
            </button>
            <a href={menuUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <ExternalLink size={17} />
              Ver menu
            </a>
            <button type="button" onClick={handleDownload} disabled={!qrDataUrl || downloading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              {downloading ? <Loader2 className="animate-spin" size={17} /> : <Download size={17} />}
              Descargar QR
            </button>
          </div>
        </div>

        <QRCard value={menuUrl} businessName={businessName} downloading={downloading} onDownloadReady={handleQrReady} />
      </div>
    </Card>
  );
}
