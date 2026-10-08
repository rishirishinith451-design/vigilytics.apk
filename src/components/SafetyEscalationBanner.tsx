import React from 'react';
import { ShieldAlert, AlertTriangle, UserCheck } from 'lucide-react';

interface SafetyEscalationBannerProps {
  urgentCount: number;
  onFilterUrgent: () => void;
}

export const SafetyEscalationBanner: React.FC<SafetyEscalationBannerProps> = ({
  urgentCount,
  onFilterUrgent,
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200 px-4 py-2.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-white">Clinical Decision-Support System:</span>{' '}
            <span className="text-slate-300">
              For qualified pharmacovigilance professional use only. Does not replace medical judgment or regulatory review.
              Autonomous case closure, alteration, or submission without authorized human sign-off is strictly prohibited.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {urgentCount > 0 && (
            <button
              onClick={onFilterUrgent}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded transition-colors text-xs font-medium cursor-pointer"
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>{urgentCount} P1 Expedited Cases Requiring Review</span>
            </button>
          )}

          <div className="flex items-center gap-1 text-slate-400 border-l border-slate-700 pl-3">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 font-medium">Human-in-the-Loop Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
