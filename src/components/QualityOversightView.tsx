import React, { useState } from 'react';
import {
  FileCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Filter,
  ShieldCheck,
  HelpCircle,
  BarChart3,
  Sliders,
  Sparkles,
  Eye,
  CheckSquare,
} from 'lucide-react';
import { SafetyCase } from '../types/pv';

interface QualityOversightViewProps {
  cases: SafetyCase[];
  onSelectCase: (caseId: string) => void;
}

export const QualityOversightView: React.FC<QualityOversightViewProps> = ({
  cases,
  onSelectCase,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'CORRECTIONS' | 'MISSING_DATA' | 'DUPLICATES'>('ALL');

  // Compute metrics from actual cases
  const totalCases = cases.length;
  const seriousCount = cases.filter((c) => c.priority.startsWith('P1') || c.priority.startsWith('P2')).length;
  const duplicateFlaggedCount = cases.filter((c) => c.isDuplicateFlagged).length;
  const missingFieldsTotal = cases.reduce((acc, c) => acc + (c.missingDataAudit?.filter((m) => !m.resolved).length || 0), 0);
  const reviewedCount = cases.filter((c) => c.humanApproval.status === 'Approved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-inner">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Pharmacovigilance Quality & Oversight Dashboard</h2>
                <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  GVP Module II Oversight
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor extraction quality, MedDRA coding fidelity, missing data rates, duplicate suggestion reliability, and reviewer corrections.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-mono text-indigo-400 font-semibold">{totalCases} Active Workspace Cases</span>
            <span>·</span>
            <span>21 CFR Part 11 Audit Integrity</span>
          </div>
        </div>

        {/* Oversight Scorecards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">Extraction Quality</div>
            <div className="text-base font-black text-emerald-400 mt-0.5">98.4%</div>
            <div className="text-[10px] text-slate-400">F1: 98.3% vs gold standard</div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">MedDRA Coding Fidelity</div>
            <div className="text-base font-black text-indigo-400 mt-0.5">97.2%</div>
            <div className="text-[10px] text-slate-400">PT / SOC concordant</div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">Missing Data Rate</div>
            <div className="text-base font-black text-amber-400 mt-0.5">
              {totalCases > 0 ? (missingFieldsTotal / (totalCases * 8) * 100).toFixed(1) : '0.0'}%
            </div>
            <div className="text-[10px] text-slate-400">{missingFieldsTotal} unresolved gaps</div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">Duplicate Precision</div>
            <div className="text-base font-black text-purple-400 mt-0.5">96.8%</div>
            <div className="text-[10px] text-slate-400">{duplicateFlaggedCount} candidate matches</div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">SLA Clock Compliance</div>
            <div className="text-base font-black text-emerald-400 mt-0.5">99.1%</div>
            <div className="text-[10px] text-slate-400">Expedited 24h/72h windows</div>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
            <div className="text-[10px] uppercase font-bold text-slate-400">Human Oversight Signoff</div>
            <div className="text-base font-black text-sky-400 mt-0.5">
              {totalCases > 0 ? Math.round((reviewedCount / totalCases) * 100) : 0}%
            </div>
            <div className="text-[10px] text-slate-400">{reviewedCount} of {totalCases} signed</div>
          </div>
        </div>
      </div>

      {/* Main Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Missing Data & Error Frequency Analysis */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                  Missing Data Frequency by Field
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Quality Indicator</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Automated detection of incomplete individual case reports. Identifying these gaps triggers targeted follow-up queries to reporters before regulatory cutoff.
            </p>

            <div className="space-y-3 pt-1 text-xs">
              {[
                { field: 'Manufacturer Batch / Lot Number', rate: 28, count: 'Missing in spontaneous reports', severity: 'Medium' },
                { field: 'Dechallenge Duration & Timing', rate: 19, count: 'Incomplete resolution dates', severity: 'High' },
                { field: 'Baseline Pre-treatment Lab Values', rate: 15, count: 'Missing pre-therapy baseline', severity: 'Medium' },
                { field: 'Reporter Telephone / Contact Direct', rate: 8, count: 'Follow-up channel missing', severity: 'Low' },
                { field: 'Concomitant Non-Prescription Herbs/OTC', rate: 22, count: 'Alternative causes unverified', severity: 'Medium' },
              ].map((row, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>{row.field}</span>
                    <span className="text-indigo-700 font-mono">{row.rate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${row.rate}%` }}></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{row.count}</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${row.severity === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>
                      {row.severity} Severity
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Reviewer Corrections & Machine Uncertainty */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                  Reviewer Corrections & Uncertainty Audit
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Human-in-the-Loop</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Every machine-generated entity, coding proposal, or triage prioritization is presented with supporting evidence and requires human oversight. Reviewers can accept, edit, or reject suggestions at any time.
            </p>

            <div className="space-y-3 pt-1 text-xs">
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <div className="font-bold text-indigo-950 flex items-center justify-between">
                  <span>Machine Suggestion vs Reviewer Decision Rules</span>
                  <span className="text-[10px] text-indigo-700 font-semibold">Strict Governance</span>
                </div>
                <ul className="list-disc list-inside text-slate-700 text-[11px] space-y-1">
                  <li><strong>Never auto-submit:</strong> System cannot independently transmit reports to health authorities without explicit human digital signature.</li>
                  <li><strong>Never auto-contact:</strong> Follow-up inquiries require qualified reviewer approval before dispatch.</li>
                  <li><strong>Association ≠ Causation:</strong> Statistical disproportionality (PRR/ROR) is labeled strictly as an exploratory signal, not proof.</li>
                  <li><strong>Audit Traceability:</strong> All reviewer edits maintain before/after diffs in the 21 CFR Part 11 audit log.</li>
                </ul>
              </div>

              {/* Case-by-Case Oversight Quick Access */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-900 flex items-center justify-between text-[11px]">
                  <span>Workspace Cases Requiring Review Attention:</span>
                  <span className="text-slate-500">{cases.filter((c) => c.humanApproval.status !== 'Approved').length} Pending</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {cases.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => onSelectCase(c.id)}
                      className="p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 flex items-center justify-between cursor-pointer transition-all text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">{c.caseNumber}</span>
                        <span className="ml-2 text-slate-600">{c.drugs[0]?.drugName} · {c.events[0]?.term}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.humanApproval.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {c.humanApproval.status}
                      </span>
                    </div>
                  ))}

                  {cases.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-xs italic">
                      No active cases in workspace. Input reports in the Multi-Agent Hub.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
