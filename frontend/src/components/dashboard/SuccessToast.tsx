interface SuccessToastProps {
  message: string;
}

export function SuccessToast({ message }: SuccessToastProps) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
      {message}
    </div>
  );
}
