import React, { useState } from 'react';
import { User, Shield, Check, Settings, ChevronDown, Lock, Eye, Building2, Globe } from 'lucide-react';
import { UserPersona, SystemConfiguration } from '../types/pv';
import { DEFAULT_USER_PERSONAS } from '../data/userPersonas';

interface UserRoleSwitcherProps {
  currentUser: UserPersona;
  onSwitchUser: (newUser: UserPersona) => void;
  systemConfig: SystemConfiguration;
  onOpenConfig: () => void;
}

export const UserRoleSwitcher: React.FC<UserRoleSwitcherProps> = ({
  currentUser,
  onSwitchUser,
  systemConfig,
  onOpenConfig,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SAFETY_LEAD_QPPV':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PV_MEDICAL_REVIEWER':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'PV_TRIAGE_SPECIALIST':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'DATA_PRIVACY_AUDITOR':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Jurisdiction & Org Badge */}
        <button
          onClick={onOpenConfig}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
          title="Click to view/change system configuration & jurisdiction"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-600" />
          <span className="truncate max-w-[130px] font-semibold">{systemConfig.primaryJurisdiction.split(' ')[0]}</span>
          <span className="text-slate-300">·</span>
          <Settings className="w-3 h-3 text-slate-400" />
        </button>

        {/* Persona Pill Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer text-left"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
            {currentUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="hidden sm:block text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-900 leading-tight">{currentUser.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getRoleBadgeColor(currentUser.role)}`}>
                {currentUser.roleTitle.split(' ')[0]}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">{currentUser.credentials}</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="border-b border-slate-100 pb-2.5 mb-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Switch Reviewer Role (RBAC Simulation)
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Change personas to test role-based permissions, privacy masking, and approval gates.
            </p>
          </div>

          <div className="space-y-1.5">
            {DEFAULT_USER_PERSONAS.map((persona) => {
              const isSelected = persona.id === currentUser.id;

              return (
                <div
                  key={persona.id}
                  onClick={() => {
                    onSwitchUser(persona);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/20'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{persona.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <div className="text-[11px] font-medium text-indigo-700">{persona.roleTitle}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{persona.credentials}</div>
                    </div>

                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getRoleBadgeColor(persona.role)}`}>
                      {persona.role.split('_')[0]}
                    </span>
                  </div>

                  {/* Permissions Summary Badges */}
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100/80 text-[10px]">
                    <span className={`px-1.5 py-0.2 rounded font-medium ${persona.canApproveAssessments ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                      {persona.canApproveAssessments ? '✓ Approvals' : '✕ No Approvals'}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded font-medium ${persona.canAuthorizeRegulatorySubmission ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-400'}`}>
                      {persona.canAuthorizeRegulatorySubmission ? '✓ Reg. Submission' : '✕ No Reg. Sub'}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded font-medium ${persona.canUnmaskPII ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}>
                      {persona.canUnmaskPII ? '✓ Unmask PII' : '✕ Masked'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenConfig();
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              <span>Configure Organization & Jurisdictions</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
