import React, { useState } from 'react';
import { X, Building2, Globe, Shield, Database, Check, Sliders, Info, FileCheck } from 'lucide-react';
import { SystemConfiguration } from '../types/pv';

interface SystemConfigModalProps {
  config: SystemConfiguration;
  onClose: () => void;
  onSaveConfig: (updated: SystemConfiguration) => void;
}

export const SystemConfigModal: React.FC<SystemConfigModalProps> = ({
  config,
  onClose,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<SystemConfiguration>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    onSaveConfig(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">System & Jurisdiction Configuration</h2>
              <p className="text-xs text-slate-400">Configure pharmacovigilance operating parameters, regulatory standards, and RBAC rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Organization Type */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              Organization Type & Environment
            </label>
            <select
              value={formData.organizationType}
              onChange={(e) => setFormData({ ...formData, organizationType: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Pharmaceutical MAH">Pharmaceutical / Biotech Marketing Authorization Holder (MAH)</option>
              <option value="Hospital PV Unit">Hospital / Academic Health Center Pharmacovigilance Department</option>
              <option value="Clinical Research Organization (CRO)">Contract / Clinical Research Organization (CRO Safety Desk)</option>
              <option value="Regulatory Health Authority">National / Regional Regulatory Health Authority</option>
            </select>
          </div>

          {/* Organization Name */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              Organization / Department Name
            </label>
            <input
              type="text"
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Primary Jurisdiction */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              Primary Regulatory Jurisdiction & Compliance Rules
            </label>
            <select
              value={formData.primaryJurisdiction}
              onChange={(e) => setFormData({ ...formData, primaryJurisdiction: e.target.value as any })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="US FDA (21 CFR 314.80)">United States FDA (21 CFR 314.80 / 312.32 & MedWatch 3500A)</option>
              <option value="EU EMA (GVP Module VI)">European Union EMA (GVP Module VI & EudraVigilance / E2B R3)</option>
              <option value="Japan PMDA">Japan PMDA (Pharmaceuticals and Medical Devices Agency)</option>
              <option value="UK MHRA">United Kingdom MHRA (Yellow Card & GVP Harmonized)</option>
              <option value="Health Canada">Health Canada (Canada Vigilance Program / MedEffect)</option>
            </select>
          </div>

          {/* Standards & Retention Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
                Case & Reporting Standards
              </label>
              <input
                type="text"
                disabled
                value={formData.caseStandard}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
                MedDRA Terminology Release
              </label>
              <input
                type="text"
                value={formData.meddraVersion}
                onChange={(e) => setFormData({ ...formData, meddraVersion: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Security & Privacy Settings */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Data Protection & Audit Governance</span>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.piiMaskingEnabled}
                  onChange={(e) => setFormData({ ...formData, piiMaskingEnabled: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-800">
                  Enable Patient & Reporter PII/PHI Masking by Default
                </span>
              </label>
              <p className="text-[11px] text-slate-500 pl-5">
                Masks initials and contact records until explicitly unmasked by authorized medical reviewers with mandatory audit justification.
              </p>

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={formData.requireDualSignoffForFatalCases}
                  onChange={(e) => setFormData({ ...formData, requireDualSignoffForFatalCases: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-800">
                  Require Dual Medical Officer Sign-off for Fatal / Life-Threatening Cases
                </span>
              </label>
              <p className="text-[11px] text-slate-500 pl-5">
                Enforces both Medical Reviewer and Safety Lead / QPPV digital signatures prior to regulatory submission.
              </p>
            </div>
          </div>

          {/* Approved Intake Sources */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              Approved Intake Sources & Integrations
            </label>
            <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
              {formData.approvedIntakeSources.map((src, i) => (
                <div key={i} className="flex items-center gap-1.5 text-slate-700">
                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{src}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Audit logging active. System compliant with 21 CFR Part 11 & GVP Module II.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{savedSuccess ? 'Configuration Saved!' : 'Save System Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
