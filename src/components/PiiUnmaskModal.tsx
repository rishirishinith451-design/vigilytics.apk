import React, { useState } from 'react';
import { X, Lock, Eye, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { UserPersona } from '../types/pv';

interface PiiUnmaskModalProps {
  currentUser: UserPersona;
  caseNumber: string;
  onClose: () => void;
  onConfirmUnmask: (reason: string, purpose: string) => void;
}

export const PiiUnmaskModal: React.FC<PiiUnmaskModalProps> = ({
  currentUser,
  caseNumber,
  onClose,
  onConfirmUnmask,
}) => {
  const [purpose, setPurpose] = useState('Safety follow-up inquiry to treating HCP under ICH E2D');
  const [justification, setJustification] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!justification.trim()) {
      setValidationError('A specific clinical or regulatory justification is required to unmask identifiable information.');
      return;
    }
    if (!acknowledged) {
      setValidationError('Please confirm privacy acknowledgement.');
      return;
    }
    setValidationError(null);
    onConfirmUnmask(justification.trim(), purpose);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Access Protected Patient & Reporter Information</h2>
              <p className="text-[11px] text-slate-400">Case: {caseNumber} · 21 CFR Part 11 Audit Gate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Restricted Confidential Health Information (PII/PHI)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Unmasking patient demographics and reporter identity is strictly logged in the tamper-evident audit history. You must provide a valid clinical or regulatory justification.
            </p>
          </div>

          <div>
            <label className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block mb-1">
              Authorized Reviewer
            </label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium">
              {currentUser.name} ({currentUser.roleTitle}) · {currentUser.email}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block mb-1">
              Legitimate Access Purpose *
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Safety follow-up inquiry to treating HCP under ICH E2D">Safety follow-up inquiry to treating HCP (ICH E2D)</option>
              <option value="Urgent regulatory authority request (FDA / EMA inspection)">Urgent regulatory authority request (FDA / EMA inspection)</option>
              <option value="Direct HCP clarifying telephone / email correspondence">Direct HCP clarifying telephone / email correspondence</option>
              <option value="Medical record reconciliation & hospital confirmation">Medical record reconciliation & hospital confirmation</option>
              <option value="Suspected duplicate record disambiguation">Suspected duplicate record disambiguation</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block mb-1">
              Detailed Clinical / Audit Justification *
            </label>
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why accessing unmasked patient or reporter contact details is required for this case assessment..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <label className="flex items-start gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-600 leading-tight">
              I certify that I am authorized to access this personal information under applicable pharmacovigilance and privacy regulations (HIPAA / GDPR / GVP Module VI).
            </span>
          </label>

          {validationError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!justification.trim() || !acknowledged}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Confirm & Log Access in Audit Trail</span>
          </button>
        </div>
      </div>
    </div>
  );
};
