interface Props {
  open: boolean;
  stage: 'image_selected' | 'uploading' | 'processing' | 'success' | 'error' | 'timeout';
  message?: string;
  itemsFound?: number;
  itemsRequiringReview?: number;
}

export function OCRProcessingModal({ open, stage, message, itemsFound = 0, itemsRequiringReview = 0 }: Props) {
  if (!open) return null;
  const defaultMessage = stage === 'image_selected'
    ? 'Imagen cargada.'
    : stage === 'uploading'
      ? 'Subiendo factura...'
      : stage === 'processing'
        ? 'Estamos leyendo la factura...'
        : stage === 'success'
          ? `Encontramos ${itemsFound} productos. Solo necesitamos revisar ${itemsRequiringReview}.`
          : stage === 'timeout'
            ? 'El analisis esta tardando mas de lo esperado.'
            : 'No pudimos leer la factura.';
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        <p className="mt-5 text-lg font-semibold text-slate-900">{message ?? defaultMessage}</p>
        <p className="mt-2 text-sm text-slate-500">Pedilo arma el borrador, vos tenes la ultima palabra.</p>
      </div>
    </div>
  );
}
