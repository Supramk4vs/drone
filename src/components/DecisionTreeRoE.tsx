import React from 'react';
import { DecisionLogEntry } from '../types/tactical';

interface DecisionTreeRoEProps {
  decisionLogs: DecisionLogEntry[];
  complianceScore: number; // 0 - 100%
  currentStep: number; // 1 to 6
}

export const DecisionTreeRoE: React.FC<DecisionTreeRoEProps> = ({
  decisionLogs,
  complianceScore,
  currentStep,
}) => {
  const steps = [
    { num: 1, title: '1. DETECT' },
    { num: 2, title: '2. IDENTIFY' },
    { num: 3, title: '3. INTENT' },
    { num: 4, title: '4. ROE WEAPON' },
    { num: 5, title: '5. CLEARANCE' },
    { num: 6, title: '6. NEUTRALIZE' },
  ];

  return (
    <div className="flex flex-col bg-[#070e10] border border-[#14282c] rounded p-2 shadow-lg select-none text-[11px] font-mono">
      {/* Header */}
      <div className="w-full flex items-center justify-between pb-1 border-b border-[#14282c]">
        <div className="flex items-center gap-1.5 text-[#00ffaa]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa]" />
          <span className="font-bold">ROE DECISION-TREE</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-[9px]">COMPLIANCE:</span>
          <span className={`font-bold ${
            complianceScore >= 80 ? 'text-[#00ffaa]' : complianceScore >= 60 ? 'text-[#ffaa00]' : 'text-[#ff3344]'
          }`}>
            {complianceScore}%
          </span>
        </div>
      </div>

      {/* Visual Branching Steps (Clean 3x2 Grid) */}
      <div className="mt-1.5 grid grid-cols-3 gap-1 border-b border-[#14282c] pb-1.5">
        {steps.map((st) => {
          const isActive = st.num === currentStep;
          const isPast = st.num < currentStep;

          return (
            <div
              key={st.num}
              className={`px-1.5 py-1 rounded text-center transition-all ${
                isActive
                  ? 'bg-[#00ffaa]/20 border border-[#00ffaa] text-[#00ffaa] font-bold shadow-sm'
                  : isPast
                  ? 'bg-[#0b1c18] border border-[#164234] text-[#48bca0]'
                  : 'bg-[#091214] border border-[#122226] text-gray-500'
              }`}
            >
              <div className="text-[9px] leading-tight truncate">{st.title}</div>
            </div>
          );
        })}
      </div>

      {/* Live Explainability Audit Log */}
      <div className="mt-1.5 flex flex-col">
        <div className="text-[9px] text-gray-400 font-bold mb-1 flex justify-between">
          <span>AUDIT LOG:</span>
          <span>{decisionLogs.length} EVENTS</span>
        </div>

        <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5">
          {decisionLogs.length === 0 ? (
            <div className="text-gray-500 text-center py-2.5 italic text-[10px]">
              Awaiting tactical engagements. Actions are audited against DSSC Form-904 doctrine.
            </div>
          ) : (
            decisionLogs.slice(0, 6).map((log) => {
              const isCompliant = log.roeStatus === 'COMPLIANT' || log.roeStatus === 'EXCELLENT';
              return (
                <div
                  key={log.id}
                  className={`p-1 rounded border text-[9.5px] ${
                    isCompliant
                      ? 'bg-[#091f1a]/80 border-[#1b503e] text-[#a7f3d0]'
                      : 'bg-[#260f12]/80 border-[#661c24] text-[#fca5a5]'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="truncate max-w-[190px]">
                      {isCompliant ? '✔' : '⚠'} {log.ruleTitle}
                    </span>
                    <span className={log.scoreDelta >= 0 ? 'text-[#00ffaa]' : 'text-[#ff3344]'}>
                      {log.scoreDelta >= 0 ? `+${log.scoreDelta}` : log.scoreDelta}
                    </span>
                  </div>
                  <div className="text-[8.5px] opacity-80 mt-0.5 truncate text-gray-300">
                    {log.reasoning}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
