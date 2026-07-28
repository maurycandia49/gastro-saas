import { Link } from 'react-router-dom';
import { Check, Lightbulb, X } from 'lucide-react';
import type { Opportunity } from '../../services/opportunities';

const severityStyles = {
  critical: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export function OpportunityCard({ opportunity, onRead, onDismiss }: { opportunity: Opportunity; onRead: () => void; onDismiss: () => void }) {
  return (
    <article className={`rounded-3xl border p-5 shadow-sm ${severityStyles[opportunity.severity]}`}>
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-white/70 p-2"><Lightbulb size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold uppercase tracking-wide">{opportunity.category}</span>
            <span className="text-xs">Prioridad {opportunity.priority}</span>
            {opportunity.score_impact ? <span className="text-xs">Impacto +{opportunity.score_impact} pts</span> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{opportunity.title}</h3>
          <p className="mt-2 text-sm opacity-90">{opportunity.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {opportunity.action_url && opportunity.action_label ? <Link to={opportunity.action_url} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{opportunity.action_label}</Link> : null}
            {!opportunity.read ? <button type="button" onClick={onRead} className="inline-flex items-center gap-1 rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold"><Check size={15} /> Leida</button> : null}
            <button type="button" onClick={onDismiss} className="inline-flex items-center gap-1 rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold"><X size={15} /> Descartar</button>
          </div>
        </div>
      </div>
    </article>
  );
}
