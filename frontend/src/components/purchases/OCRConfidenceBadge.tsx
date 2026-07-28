interface Props {
  confidence: number;
}

export function OCRConfidenceBadge({ confidence }: Props) {
  const tone = confidence >= 90 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : confidence >= 70 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200';
  const label = confidence >= 90 ? 'Alta' : confidence >= 70 ? 'Revisar' : 'Manual';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{label} · {confidence}%</span>;
}
