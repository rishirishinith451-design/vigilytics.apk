import React, { useState } from 'react';
import { Mail, Copy, Check, Download, X, FileText, Send } from 'lucide-react';
import { SafetyCase, MissingDataAudit } from '../types/pv';

interface FollowUpLetterModalProps {
  currentCase: SafetyCase;
  onClose: () => void;
  onSendQuery: (queryFieldId: string) => void;
}

export const FollowUpLetterModal: React.FC<FollowUpLetterModalProps> = ({
  currentCase,
  onClose,
  onSendQuery,
}) => {
  const [copied, setCopied] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('clinical.safety@mskcc.org');
  const [sentSuccess, setSentSuccess] = useState(false);

  const missingItems = (currentCase.missingDataAudit || []).filter((m) => !m.resolved);

  const letterBody = `CONFIDENTIAL PHARMACOVIGILANCE FOLLOW-UP QUERY
Date: ${new Date().toISOString().split('T')[0]}
Case Reference ID: ${currentCase.caseNumber} (v${currentCase.version || 1})
Suspect Product: ${currentCase.drugs?.map((d) => d.drugName).join(', ') || 'Suspect Product'}
Reported Adverse Event(s): ${currentCase.events?.map((e) => e.term).join(', ') || 'Adverse Event'}
Original Reporter: ${currentCase.reporterQualification || 'Healthcare Professional'} (${currentCase.primarySource || 'Spontaneous'})

Dear Colleague,

Thank you for your initial safety notification regarding patient ${currentCase.patient?.initials || 'PT'} (${currentCase.patient?.age || 'Unknown'}yo ${currentCase.patient?.sex || 'Unknown'}). In accordance with ICH E2D and regulatory pharmacovigilance safety reporting standards, our clinical safety evaluation team is requesting additional targeted clinical details to complete the causality assessment and regulatory submission:

REQUESTED CLINICAL INFORMATION:
${missingItems
  .map(
    (item, idx) =>
      `${idx + 1}. [${item.severity.toUpperCase()} PRIORITY] ${item.field}
   Clinical Rationale: ${item.impact}
   Targeted Question: ${item.suggestedFollowUpQuery}`
  )
  .join('\n\n')}

ADDITIONAL ROUTINE QUESTIONS:
- Were any concurrent over-the-counter medications, nutritional supplements, or herbal remedies administered?
- What was the patient's baseline organ function (renal/hepatic) immediately prior to initiating ${currentCase.drugs[0]?.drugName || 'suspect medication'}?
- What is the latest clinical recovery status and any long-term functional sequelae?

Please return your response within 5 calendar days to enable timely regulatory submission compliance.

Respectfully submitted,
Pharmacovigilance & Medical Safety Team
AegisPV Safety Operations Gateway
Ref: ${currentCase.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(letterBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    missingItems.forEach((item) => onSendQuery(item.id));
    setSentSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold">Targeted Follow-up Questionnaire Generator</h3>
              <p className="text-[11px] text-slate-400">Case Reference: {currentCase.caseNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Reporter Contact</label>
              <input
                type="text"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Target Facility</label>
              <div className="mt-1 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded text-slate-700 truncate text-xs">
                {currentCase.primarySource}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Generated Regulatory Letter Body ({missingItems.length} Open Queries)
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Text'}</span>
              </button>
            </div>

            <textarea
              readOnly
              value={letterBody}
              rows={12}
              className="w-full p-3 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed focus:outline-hidden"
            />
          </div>

          {sentSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Follow-up query transmitted successfully and logged into Pega Case audit history.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Transmit & Log Query</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
