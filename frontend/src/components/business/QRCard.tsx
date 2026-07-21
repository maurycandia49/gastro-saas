import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCardProps {
  value: string;
  businessName: string;
  downloading: boolean;
  onDownloadReady: (dataUrl: string) => void;
}

export function QRCard({ value, businessName, downloading, onDownloadReady }: QRCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let mounted = true;

    async function generateQr() {
      const dataUrl = await QRCode.toDataURL(value, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 8,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      if (mounted) {
        setQrDataUrl(dataUrl);
        onDownloadReady(dataUrl);
      }
    }

    void generateQr();

    return () => {
      mounted = false;
    };
  }, [onDownloadReady, value]);

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
        {qrDataUrl ? <img src={qrDataUrl} alt={`QR del menu de ${businessName}`} className="h-full w-full" /> : <div className="h-32 w-32 animate-pulse rounded-xl bg-slate-100" />}
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        {downloading ? 'Preparando descarga...' : 'Escanealo para abrir el menu publico.'}
      </p>
    </div>
  );
}
