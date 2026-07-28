const categories = [
  ['all', 'Todas'],
  ['stock', 'Stock'],
  ['profitability', 'Rentabilidad'],
  ['sales', 'Ventas'],
  ['customers', 'Clientes'],
  ['promotions', 'Promociones'],
  ['operations', 'Operacion'],
  ['achievement', 'Logros'],
];

export function OpportunityFilters({ category, severity, onCategory, onSeverity }: { category: string; severity: string; onCategory: (value: string) => void; onSeverity: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {categories.map(([value, label]) => <button key={value} type="button" onClick={() => onCategory(value)} className={`rounded-2xl px-3 py-2 text-sm font-medium ${category === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}
      </div>
      <select value={severity} onChange={(event) => onSeverity(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
        <option value="">Todas las severidades</option>
        <option value="critical">Criticas</option>
        <option value="warning">Advertencias</option>
        <option value="info">Informativas</option>
        <option value="success">Logros</option>
      </select>
    </div>
  );
}
