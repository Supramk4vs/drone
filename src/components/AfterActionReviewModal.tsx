import React, { useRef, useEffect, useState } from 'react';
import { SimulationStats, DecisionLogEntry, Scenario } from '../types/tactical';

interface AfterActionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SimulationStats;
  decisionLogs: DecisionLogEntry[];
  currentScenario: Scenario;
}

export const AfterActionReviewModal: React.FC<AfterActionReviewModalProps> = ({
  isOpen,
  onClose,
  stats,
  decisionLogs,
  currentScenario,
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);
  const [timelineSec, setTimelineSec] = useState<number>(Math.round(stats.simTime));
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);

  // Compute 5-axis Trainee Readiness Scores (0 to 100)
  const detectionScore = Math.min(100, Math.round(stats.threatsDetected > 0 ? (stats.threatsDetected / stats.totalHostiles) * 100 : 0));
  const idScore = Math.min(100, Math.round(stats.threatsIdentified > 0 ? (stats.threatsIdentified / stats.totalHostiles) * 100 : 0));
  const roeScore = Math.min(100, Math.round(stats.roeCompliancePercent));
  const weaponScore = Math.min(100, Math.round(stats.accuracyPercent));
  const neutralizationScore = Math.min(100, Math.round(stats.threatsNeutralized > 0 ? (stats.threatsNeutralized / stats.totalHostiles) * 100 : 0));

  // Overall Grade
  const overallAvg = Math.round((detectionScore + idScore + roeScore + weaponScore + neutralizationScore) / 5);
  let grade = 'A+ (COMBAT READY)';
  let gradeColor = 'text-[#00ffaa] border-[#00ffaa]';
  if (overallAvg < 60 || stats.collateralViolations > 0) {
    grade = 'RE-TRAIN REQUIRED (ROE FAILURE)';
    gradeColor = 'text-[#ff3344] border-[#ff3344]';
  } else if (overallAvg < 75) {
    grade = 'B (QUALIFIED OPERATOR)';
    gradeColor = 'text-[#ffaa00] border-[#ffaa00]';
  } else if (overallAvg < 90) {
    grade = 'A (MISSION CAPABLE)';
    gradeColor = 'text-[#00ffaa] border-[#00ffaa]';
  }

  // Draw 5-axis Radar Chart on Canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;

    ctx.clearRect(0, 0, size, size);

    // Axes categories
    const axes = [
      { label: 'DETECTION', val: detectionScore },
      { label: 'IDENTIFICATION', val: idScore },
      { label: 'ROE ADHERENCE', val: roeScore },
      { label: 'WEAPON EFFICIENCY', val: weaponScore },
      { label: 'NEUTRALIZATION', val: neutralizationScore },
    ];
    const numAxes = axes.length;

    // Draw concentric polygon webs
    const levels = [0.25, 0.5, 0.75, 1.0];
    levels.forEach((lvl) => {
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const x = cx + Math.cos(angle) * (radius * lvl);
        const y = cy + Math.sin(angle) * (radius * lvl);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = lvl === 1.0 ? '#1b4a3c' : '#102e26';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw Spokes
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#1b4a3c';
      ctx.stroke();

      // Label
      const lx = cx + Math.cos(angle) * (radius + 22);
      const ly = cy + Math.sin(angle) * (radius + 22);
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axes[i].label, lx, ly);

      // Score value
      ctx.fillStyle = '#00ffaa';
      ctx.fillText(`${axes[i].val}%`, lx, ly + 10);
    }

    // Draw Trainee Performance Polygon
    ctx.beginPath();
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const r = (axes[i].val / 100) * radius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(0, 255, 170, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Data points
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const r = (axes[i].val / 100) * radius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00ffaa';
      ctx.fill();
    }
  }, [isOpen, detectionScore, idScore, roeScore, weaponScore, neutralizationScore]);

  // Timeline scrubber playback animation
  useEffect(() => {
    let timer: number;
    if (isPlayingTimeline) {
      timer = window.setInterval(() => {
        setTimelineSec((prev) => {
          if (prev >= stats.simTime) {
            setIsPlayingTimeline(false);
            return stats.simTime;
          }
          return prev + 1;
        });
      }, 300);
    }
    return () => clearInterval(timer);
  }, [isPlayingTimeline, stats.simTime]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-5xl bg-[#091013] border-2 border-[#163e32] rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-xs font-mono">
        {/* Security Classification Banner */}
        <div className="bg-[#5c1319] text-white py-1 px-4 text-center font-bold tracking-widest text-[11px] uppercase border-b border-[#821d26] flex justify-between items-center">
          <span>RESTRICTED // MINISTRY OF DEFENCE (DSSC) USE ONLY</span>
          <span>FORM DSSC-CUAS-904-REV-3</span>
          <span>RESTRICTED // CLASSIFIED</span>
        </div>

        {/* Modal Header */}
        <div className="p-4 bg-[#0a1518] border-b border-[#14282c] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span>AFTER-ACTION REVIEW (AAR) & TACTICAL DOSSIER</span>
            </h2>
            <div className="text-gray-400 text-xs mt-0.5">
              Defence Services Staff College | C-UAS Threat Simulation Assessment
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-[#00ffaa]/10 hover:bg-[#00ffaa]/20 border border-[#00ffaa] text-[#00ffaa] rounded font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <span>🖨</span>
              <span>PRINT DOSSIER</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold text-xs transition-all"
            >
              RESUME SIMULATION [ESC]
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Top Grade Card & Mission Parameters */}
          <div className="grid grid-cols-3 gap-4">
            {/* Overall DSSC Rating Badge */}
            <div className={`p-4 rounded-lg bg-[#070d10] border-2 ${gradeColor} flex flex-col items-center justify-center text-center shadow-lg`}>
              <div className="text-[10px] text-gray-400 tracking-wider font-bold">OPERATIONAL READINESS EVALUATION</div>
              <div className="text-2xl font-bold my-1 tracking-wider">{grade}</div>
              <div className="text-xs text-gray-400">
                COMPOSITE COMBAT SCORE: <span className="text-white font-bold">{overallAvg} / 100</span>
              </div>
            </div>

            {/* Trainee Particulars */}
            <div className="p-3 bg-[#070e11] rounded border border-[#142a26] space-y-1.5">
              <div className="text-[10px] text-[#00ffaa] font-bold border-b border-[#142a26] pb-1">
                EXERCISE SPECIFICATIONS
              </div>
              <div className="flex justify-between text-gray-300">
                <span>SCENARIO:</span>
                <span className="text-white font-bold">{currentScenario.title}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>OPERATION CODE:</span>
                <span className="text-[#ffaa00]">{currentScenario.code}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>SECTOR / BASE:</span>
                <span className="text-white">{currentScenario.location}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>THREAT LEVEL:</span>
                <span className="text-[#ff3344] font-bold">{currentScenario.threatLevel}</span>
              </div>
            </div>

            {/* Vital Mission Metrics */}
            <div className="p-3 bg-[#070e11] rounded border border-[#142a26] space-y-1.5">
              <div className="text-[10px] text-[#00ffaa] font-bold border-b border-[#142a26] pb-1">
                ENGAGEMENT PERFORMANCE
              </div>
              <div className="flex justify-between text-gray-300">
                <span>NEUTRALIZATION RATE:</span>
                <span className="text-[#00ffaa] font-bold">
                  {stats.threatsNeutralized} / {stats.totalHostiles} ({neutralizationScore}%)
                </span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>AVG TIME-TO-DETECT (TTD):</span>
                <span className="text-white font-bold">{stats.avgTTD.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>AVG TIME-TO-IDENTIFY (TTI):</span>
                <span className="text-white font-bold">{stats.avgTTI.toFixed(1)}s</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>COLLATERAL VIOLATIONS:</span>
                <span className={`font-bold ${stats.collateralViolations > 0 ? 'text-[#ff3344]' : 'text-[#00ffaa]'}`}>
                  {stats.collateralViolations} INCIDENTS
                </span>
              </div>
            </div>
          </div>

          {/* Middle Row: 5-Axis Radar Chart & Scrubbable Timeline */}
          <div className="grid grid-cols-2 gap-4">
            {/* 5-Axis Radar Chart */}
            <div className="p-3 bg-[#070e11] rounded border border-[#142a26] flex flex-col items-center">
              <div className="w-full text-left text-[11px] font-bold text-[#00ffaa] mb-1">
                5-AXIS OPERATOR READINESS RADAR
              </div>
              <canvas
                ref={radarCanvasRef}
                width={280}
                height={260}
                className="mt-1"
              />
            </div>

            {/* Scrubbable 3D Engagement Timeline Playback */}
            <div className="p-3 bg-[#070e11] rounded border border-[#142a26] flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold text-[#00ffaa] mb-1 flex items-center justify-between">
                  <span>ENGAGEMENT TIMELINE PLAYBACK</span>
                  <span className="text-[#ffaa00]">{timelineSec}s / {Math.round(stats.simTime)}s</span>
                </div>
                <div className="text-[10px] text-gray-400 mb-2">
                  Scrub timeline slider to review kinetic and electronic warfare actions in chronological sequence:
                </div>

                {/* Timeline Slider */}
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, Math.round(stats.simTime))}
                  value={timelineSec}
                  onChange={(e) => setTimelineSec(Number(e.target.value))}
                  className="w-full accent-[#00ffaa] cursor-pointer"
                />

                {/* Timeline Controls */}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    onClick={() => setTimelineSec(0)}
                    className="px-2 py-1 bg-[#102422] hover:bg-[#163832] rounded text-gray-300 text-[10px]"
                  >
                    ⏮ REWIND
                  </button>
                  <button
                    onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
                    className="px-3 py-1 bg-[#00ffaa] hover:bg-[#00e699] text-black rounded font-bold text-xs"
                  >
                    {isPlayingTimeline ? '⏸ PAUSE' : '▶ PLAY'}
                  </button>
                  <button
                    onClick={() => setTimelineSec(Math.round(stats.simTime))}
                    className="px-2 py-1 bg-[#102422] hover:bg-[#163832] rounded text-gray-300 text-[10px]"
                  >
                    FAST FWD ⏭
                  </button>
                </div>
              </div>

              {/* Active Events at selected timeline position */}
              <div className="mt-3 bg-[#060c0e] p-2.5 rounded border border-[#102620] space-y-1">
                <div className="text-[10px] text-gray-400 font-bold">
                  EVENTS RECORDED AT OR BEFORE {timelineSec} SECONDS:
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {decisionLogs.filter((d) => d.timestamp <= timelineSec).length === 0 ? (
                    <div className="text-gray-500 italic text-[10px]">No engagements prior to this timestamp.</div>
                  ) : (
                    decisionLogs
                      .filter((d) => d.timestamp <= timelineSec)
                      .slice(-3)
                      .map((log) => (
                        <div key={log.id} className="text-[10px] flex justify-between items-center text-gray-300">
                          <span>[{log.timestamp}s] {log.droneCallsign} - {log.actionTaken}</span>
                          <span className={log.scoreDelta >= 0 ? 'text-[#00ffaa]' : 'text-[#ff3344]'}>
                            {log.scoreDelta >= 0 ? `+${log.scoreDelta}` : log.scoreDelta} PTS
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Official MoD Instructor Remarks */}
          <div className="p-3 bg-[#070e11] rounded border border-[#142a26] space-y-2">
            <div className="text-[11px] font-bold text-[#00ffaa] border-b border-[#142a26] pb-1">
              DSSC INSTRUCTOR OBSERVATIONS & REMARKS
            </div>
            <div className="grid grid-cols-2 gap-4 text-[11px] text-gray-300">
              <div className="space-y-1">
                <span className="text-[#00ffaa] font-bold block">TACTICAL STRENGTHS:</span>
                <p className="text-gray-300 text-[10px] leading-relaxed">
                  Operator demonstrated proactive situational awareness on the AN/TPQ-53 Doppler radar display, acquiring targets early in the outer 2000m sector. Utilization of multi-spectrum thermal FLIR for verifying battery combustion signatures adhered to modern asymmetrical warfare standards.
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[#ffaa00] font-bold block">RECOMMENDED REMEDIATION:</span>
                <p className="text-gray-300 text-[10px] leading-relaxed">
                  Ensure strict compliance when operating in proximity to commercial airspace corridors. Deploy directional RF soft-kill disruption early before allowing autonomous Boids swarms to initiate terminal high-speed diving vectors.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#081013] border-t border-[#14282c] flex items-center justify-between text-gray-400 text-[10px]">
          <div>AUTHORIZED BY: CHIEF INSTRUCTOR (C-UAS TACTICAL DIVISION) | DSSC WELLINGTON</div>
          <div className="text-[#00ffaa] font-bold">DEFENCE SERVICES STAFF COLLEGE (DSSC) CERTIFIED</div>
        </div>
      </div>
    </div>
  );
};
