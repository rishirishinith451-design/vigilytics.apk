import React from 'react';
import {
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  User,
} from 'lucide-react';
import { PvStage, SafetyCase } from '../types/pv';

interface PvWorkflowBarProps {
  currentCase: SafetyCase;
  onAdvanceStage: (nextStage: PvStage, nextStep: string) => void;
}

const PV_STAGES: {
  id: PvStage;
  label: string;
  stepDesc: string;
  order: number;
}[] = [
  { id: 'Intake', label: '1. Ingestion & Intake', stepDesc: 'Multi-source parsing & normalization', order: 1 },
  { id: 'Triage', label: '2. Triage & Dedup', stepDesc: 'ICH E2A & duplicate match engine', order: 2 },
  { id: 'ClinicalAssessment', label: '3. Clinical Causality', stepDesc: 'Naranjo, WHO-UMC & SmPC label check', order: 3 },
  { id: 'SignalReview', label: '4. Signal & Epidemiology', stepDesc: 'Disproportionality PRR & Evans criteria', order: 4 },
  { id: 'GovernanceEscalation', label: '5. Regulatory Governance', stepDesc: 'Expedited filing & human sign-off', order: 5 },
];

export const PvWorkflowBar: React.FC<PvWorkflowBarProps> = ({
  currentCase,
  onAdvanceStage,
}) => {
  const currentStageIndex = PV_STAGES.findIndex((s) => s.id === currentCase.pegaStage);

  const getNextStageInfo = (): { stage: PvStage; step: string } | null => {
    if (currentCase.pegaStage === 'Intake') {
      return { stage: 'Triage', step: 'ICH E2A Seriousness & Deduplication' };
    }
    if (currentCase.pegaStage === 'Triage') {
      return { stage: 'ClinicalAssessment', step: 'Medical Causality Adjudication' };
    }
    if (currentCase.pegaStage === 'ClinicalAssessment') {
      return { stage: 'SignalReview', step: 'Aggregate Disproportionality Review' };
    }
    if (currentCase.pegaStage === 'SignalReview') {
      return { stage: 'GovernanceEscalation', step: 'Safety Review Board & Human Sign-off' };
    }
    return null;
  };

  const nextStageInfo = getNextStageInfo();

  const getUrgencyColor = (score: number) => {
    if (score >= 80) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-slate-700 bg-slate-100 border-slate-200';
  };

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs">
      {/* Case Header Metadata */}
      <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs tracking-wider">
            PV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 text-sm">{currentCase.caseNumber}</span>
              <span className="text-xs text-slate-500">v{currentCase.version}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-600 font-medium">Stage: {currentCase.pegaStage}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                Step: {currentCase.pegaStep}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                Work Queue: <strong className="text-slate-700 font-semibold">{currentCase.pegaWorkQueue}</strong>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Assigned: <strong className="text-slate-700 font-semibold">{currentCase.assignedOperator}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* SLA & Urgency Widget */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Regulatory SLA Clock</div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>{currentCase.pegaSLA.hoursRemaining}h remaining</span>
                <span className="text-[10px] text-slate-500">({currentCase.pegaSLA.regulatoryDeadlineType})</span>
              </div>
            </div>

            <div className={`px-2.5 py-1 rounded-md border text-center ${getUrgencyColor(currentCase.pegaSLA.urgencyScore)}`}>
              <div className="text-[10px] uppercase font-bold tracking-tight">Urgency</div>
              <div className="text-sm font-extrabold">{currentCase.pegaSLA.urgencyScore}/100</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            {nextStageInfo ? (
              <button
                onClick={() => onAdvanceStage(nextStageInfo.stage, nextStageInfo.step)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors cursor-pointer"
              >
                <span>Advance to Stage {nextStageInfo.stage}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Governance Stage Reached</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chevron Stage Bar */}
      <div className="px-6 py-2.5 overflow-x-auto">
        <div className="flex items-stretch gap-1 min-w-[760px]">
          {PV_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;

            let stageBg = 'bg-slate-100 text-slate-400 border-slate-200';
            if (isCompleted) {
              stageBg = 'bg-emerald-50 text-emerald-900 border-emerald-200';
            } else if (isCurrent) {
              stageBg = 'bg-indigo-50 text-indigo-950 border-indigo-300 shadow-xs ring-1 ring-indigo-400/30';
            }

            return (
              <div
                key={stage.id}
                className={`flex-1 relative px-3.5 py-2 rounded-lg border transition-all ${stageBg}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-tight">{stage.label}</span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  {isCurrent && (
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{stage.stepDesc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
