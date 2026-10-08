import React, { useState } from 'react';
import {
  X,
  Layers,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Info,
  Pill,
  Activity,
  ArrowRight,
  BookOpen,
  Stethoscope,
  Scale,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AdverseEvent, DrugAdministration } from '../types/pv';
import {
  assessDrugDdiAndAdr,
  assessPairwiseDdi,
  DrugDdiAdrAssessment,
  DDI_KNOWLEDGE_BASE,
} from '../utils/ddiEngine';

interface DdiAdrDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDrug: DrugAdministration | null;
  allDrugs: DrugAdministration[];
  events: AdverseEvent[];
  initialCounterpartDrug?: string;
}

export const DdiAdrDetailModal: React.FC<DdiAdrDetailModalProps> = ({
  isOpen,
  onClose,
  targetDrug,
  allDrugs,
  events,
  initialCounterpartDrug,
}) => {
  if (!isOpen || !targetDrug) return null;

  // Selected counterpart drug for pairwise deep dive
  const availableCounterparts = allDrugs
    .filter((d) => d.id !== targetDrug.id && d.drugName !== targetDrug.drugName)
    .map((d) => d.drugName);

  const [selectedCounterpart, setSelectedCounterpart] = useState<string>(
    initialCounterpartDrug || availableCounterparts[0] || ''
  );

  // Custom drug simulator state
  const [simulatorMode, setSimulatorMode] = useState(false);
  const [customDrugName, setCustomDrugName] = useState('');

  // Assessment for current target drug against all drugs in case
  const generalAssessment: DrugDdiAdrAssessment = assessDrugDdiAndAdr(
    targetDrug,
    allDrugs,
    events
  );

  // Pairwise assessment if counterpart is selected
  const activeCounterpartName = simulatorMode ? customDrugName : selectedCounterpart;
  const pairwiseAssessment: DrugDdiAdrAssessment | null = activeCounterpartName
    ? assessPairwiseDdi(targetDrug.drugName, activeCounterpartName, events)
    : null;

  const currentDisplayAssessment = pairwiseAssessment || generalAssessment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">
                  Drug-Drug Interaction & ADR Causality Assessment
                </h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-indigo-500/30 text-indigo-200 rounded border border-indigo-400/40">
                  ICH E2A & FDA DDI Standard
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Evaluation: Does this interaction explain or exacerbate the reported adverse drug reaction?
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Target Drug & Regimen Ribbon */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Screened Medication ({targetDrug.role})
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-extrabold text-slate-900">{targetDrug.drugName}</span>
                <span className="text-xs text-slate-500">
                  ({targetDrug.activeSubstance || targetDrug.drugName})
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                  {targetDrug.dose} · {targetDrug.route}
                </span>
              </div>
            </div>

            {/* Reported Adverse Events Banner */}
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Target ADRs Being Evaluated
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1 mt-0.5">
                {events.map((e, i) => (
                  <span
                    key={i}
                    className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded"
                  >
                    {e.term}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* THE CORE QUESTION ANSWER: MAY THIS DDI BE THE REASON FOR THE ADR? */}
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              currentDisplayAssessment.adrCausalityRole === 'Likely ADR Cause / Primary Driver'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : currentDisplayAssessment.adrCausalityRole === 'Possible Contributing Factor'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentDisplayAssessment.adrCausalityRole === 'Likely ADR Cause / Primary Driver' ? (
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                ) : currentDisplayAssessment.adrCausalityRole === 'Possible Contributing Factor' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    ADR Causality Verdict (DDI Etiology Assessment)
                  </span>
                  <div className="text-sm font-black tracking-tight">
                    {currentDisplayAssessment.adrCausalityRole === 'Likely ADR Cause / Primary Driver'
                      ? 'YES — LIKELY CAUSE OR PRIMARY DRIVER OF THE REPORTED ADR'
                      : currentDisplayAssessment.adrCausalityRole === 'Possible Contributing Factor'
                      ? 'POSSIBLE CONTRIBUTING FACTOR / PHARMACODYNAMIC COFACTOR'
                      : 'UNLIKELY TO BE THE PRIMARY REASON FOR THIS ADR'}
                  </div>
                </div>
              </div>

              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${
                  currentDisplayAssessment.severity === 'Contraindicated / Severe'
                    ? 'bg-rose-600 text-white border-rose-700'
                    : currentDisplayAssessment.severity === 'Major / High Risk'
                    ? 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold'
                    : currentDisplayAssessment.severity === 'Moderate / Caution'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                Severity: {currentDisplayAssessment.severity}
              </span>
            </div>

            <p className="text-xs leading-relaxed font-medium pt-1">
              {currentDisplayAssessment.adrMatchExplanation}
            </p>
          </div>

          {/* Pairwise Selection Toolbar */}
          {availableCounterparts.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Select Co-Administered Drug to Inspect Pairwise Interaction:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSimulatorMode(!simulatorMode)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  {simulatorMode ? '← Back to Case Regimen' : '+ Test Another Drug (Simulator)'}
                </button>
              </div>

              {!simulatorMode ? (
                <div className="flex flex-wrap gap-1.5">
                  {availableCounterparts.map((drugName) => (
                    <button
                      key={drugName}
                      type="button"
                      onClick={() => setSelectedCounterpart(drugName)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedCounterpart === drugName
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{targetDrug.drugName}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span>{drugName}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customDrugName}
                    onChange={(e) => setCustomDrugName(e.target.value)}
                    placeholder="Enter any medication name (e.g. Clarithromycin, Fluconazole, Warfarin, Ketoconazole)"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-500">
                    Testing interaction against <strong>{targetDrug.drugName}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Pharmacological Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mechanism & Molecular Target */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <div className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Stethoscope className="w-4 h-4 text-indigo-600" />
                <span>Pharmacological Interaction Mechanism</span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Interaction Mechanism Type:</span>
                  <div className="text-xs font-bold text-indigo-900 mt-0.5">
                    {currentDisplayAssessment.mechanismType}
                  </div>
                </div>

                {currentDisplayAssessment.cypOrTarget && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Target Isoenzyme / Biological Pathway:</span>
                    <div className="text-xs font-mono font-bold text-slate-800 mt-0.5 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                      {currentDisplayAssessment.cypOrTarget}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Detailed Pharmacokinetics / Dynamics:</span>
                  <p className="text-[11px] text-slate-700 leading-relaxed mt-0.5">
                    {currentDisplayAssessment.mechanism}
                  </p>
                </div>
              </div>
            </div>

            {/* Clinical Management & Regulatory Action */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <div className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>Clinical Management & Regulatory Guidance</span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Recommended Clinical Action:</span>
                  <p className="text-[11px] text-slate-700 leading-relaxed mt-0.5 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200 font-medium text-emerald-950">
                    {currentDisplayAssessment.clinicalAdvice}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Evidence Level & Regulatory Classification:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded font-semibold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                      {currentDisplayAssessment.evidenceLevel}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      SmPC Sec 4.5 / USPI Drug Interactions
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Preventability Impact (Schumock Q5):</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {currentDisplayAssessment.hasInteraction && currentDisplayAssessment.mayCauseAdr
                      ? 'Positive: Adverse reaction is considered definitely preventable if drug-drug interaction was documented in approved labeling.'
                      : 'Negative: Adverse reaction is unpredictable from labeled interaction mechanisms alone.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>ICH E2B(R3) G.k.2.2 Suspect / Concomitant / Interacting drug role verified.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Close Assessment
          </button>
        </div>
      </div>
    </div>
  );
};
