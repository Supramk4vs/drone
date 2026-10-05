import React, { useState } from 'react';
import { Scenario } from '../types/tactical';
import { tacticalAudio } from '../services/audioSynthesizer';

interface ScenarioHeaderProps {
  scenarios: Scenario[];
  currentScenario: Scenario;
  onSelectScenario: (scenario: Scenario) => void;
  baseHealth: number;
  simTime: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onResetSim: () => void;
  threatsRemaining: number;
  score: number;
  timeOfDay: 'DAY' | 'NIGHT' | 'DUSK';
  onToggleTimeOfDay: (tod: 'DAY' | 'NIGHT' | 'DUSK') => void;
}

export const ScenarioHeader: React.FC<ScenarioHeaderProps> = ({
  scenarios,
  currentScenario,
  onSelectScenario,
  baseHealth,
  simTime,
  isPaused,
  onTogglePause,
  onResetSim,
  threatsRemaining,
  score,
  timeOfDay,
  onToggleTimeOfDay,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    tacticalAudio.setMuted(newMuted);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <header className="w-full h-12 bg-[#070e11] border-b border-[#14282c] px-3 flex items-center justify-between text-xs font-mono select-none shadow-lg z-20 shrink-0">
        {/* Left: Ministry Branding & Scenario Picker */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#00ffaa]/10 border border-[#00ffaa]/60 flex items-center justify-center font-bold text-[#00ffaa] text-sm">
              🎯
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-white tracking-wider text-[12px]">C-UAS TACTICAL SIM</span>
                <span className="text-[9px] px-1 py-0.2 bg-[#00ffaa]/15 border border-[#00ffaa]/40 text-[#00ffaa] rounded font-bold">
                  MoD - DSSC
                </span>
              </div>
              <span className="text-[9px] text-gray-400 leading-tight">COUNTER-DRONE DOCTRINE</span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-[#16342e]" />

          {/* Scenario Selector Dropdown */}
          <div className="flex items-center gap-1">
            <select
              value={currentScenario.id}
              onChange={(e) => {
                const sc = scenarios.find((s) => s.id === e.target.value);
                if (sc) onSelectScenario(sc);
              }}
              className="bg-[#0b1a1e] text-[#00ffaa] border border-[#183a32] rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#00ffaa] cursor-pointer"
            >
              {scenarios.map((sc) => (
                <option key={sc.id} value={sc.id} className="bg-[#081114] text-white">
                  [{sc.code}] {sc.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Mission Vital Telemetry HUD Strip */}
        <div className="flex items-center gap-2">
          {/* Base Health / Integrity */}
          <div className="flex items-center gap-1.5 bg-[#091518] px-2 py-1 rounded border border-[#132d26] text-[11px]">
            <span className="text-[9px] text-gray-400 font-bold">BASE:</span>
            <div className="w-16 bg-black/70 h-1.5 rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  baseHealth > 60
                    ? 'bg-[#00ffaa]'
                    : baseHealth > 30
                    ? 'bg-[#ffaa00]'
                    : 'bg-[#ff3344] animate-pulse'
                }`}
                style={{ width: `${baseHealth}%` }}
              />
            </div>
            <span className={`font-bold ${
              baseHealth > 60 ? 'text-[#00ffaa]' : baseHealth > 30 ? 'text-[#ffaa00]' : 'text-[#ff3344]'
            }`}>
              {baseHealth}%
            </span>
          </div>

          {/* Threat Level */}
          <div className="flex items-center gap-1 bg-[#091518] px-2 py-1 rounded border border-[#132d26] text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff3344] animate-ping" />
            <span className="font-bold text-[#ff3344] text-[10px]">{currentScenario.threatLevel}</span>
          </div>

          {/* Active Hostile Count */}
          <div className="flex items-center gap-1 bg-[#091518] px-2 py-1 rounded border border-[#132d26] text-[11px]">
            <span className="text-[9px] text-gray-400">TRACKS:</span>
            <span className="font-bold text-white">{threatsRemaining}</span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-1 bg-[#091518] px-2 py-1 rounded border border-[#132d26] text-[11px]">
            <span className="text-[9px] text-gray-400">SCORE:</span>
            <span className="font-bold text-[#00ffaa]">{score}</span>
          </div>

          {/* Mission Timer */}
          <div className="flex items-center gap-1 bg-[#091518] px-2 py-1 rounded border border-[#132d26] text-[11px]">
            <span className="text-[9px] text-gray-400">TIME:</span>
            <span className="font-bold text-[#ffaa00]">{formatTime(simTime)}</span>
          </div>
        </div>

        {/* Right: Controls & Help */}
        <div className="flex items-center gap-1.5">
          {/* Time of Day Switcher (Morning / Night) */}
          <button
            onClick={() => onToggleTimeOfDay(timeOfDay === 'DAY' ? 'NIGHT' : 'DAY')}
            className={`px-2 py-1 rounded font-bold border transition-all text-[11px] flex items-center gap-1 ${
              timeOfDay === 'DAY'
                ? 'bg-[#ffaa00] text-black border-[#ffaa00] shadow'
                : 'bg-[#122230] text-[#8ec5fc] border-[#203c54] hover:bg-[#1a3248]'
            }`}
            title="Toggle Morning / Night Mode"
          >
            <span>{timeOfDay === 'DAY' ? '☀️ MORNING' : '🌙 NIGHT'}</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={onTogglePause}
            className={`px-2 py-1 rounded font-bold border transition-all text-[11px] flex items-center gap-1 ${
              isPaused
                ? 'bg-[#ffaa00] text-black border-[#ffaa00]'
                : 'bg-[#0f2422] text-[#00ffaa] border-[#164436] hover:bg-[#164436]'
            }`}
          >
            <span>{isPaused ? '▶' : '⏸'}</span>
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Reset */}
          <button
            onClick={onResetSim}
            className="px-2 py-1 bg-[#131d20] hover:bg-[#1f2d32] text-gray-300 border border-[#23353c] rounded text-[11px] transition-all flex items-center gap-1"
            title="Reset Scenario"
          >
            <span>🔄</span>
          </button>

          {/* Audio Mute */}
          <button
            onClick={toggleMute}
            className={`px-2 py-1 rounded border text-[11px] transition-all ${
              isMuted
                ? 'bg-[#ff3344]/20 border-[#ff3344] text-[#ff3344]'
                : 'bg-[#0f2422] border-[#164436] text-[#00ffaa] hover:bg-[#164436]'
            }`}
            title="Toggle Audio"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          {/* Hotkeys / Help Guide */}
          <button
            onClick={() => setShowHelp(true)}
            className="px-2 py-1 bg-[#0b1c20] hover:bg-[#133038] border border-[#1b3d36] text-[#00ffaa] rounded text-[11px] font-bold"
          >
            KEYS [?]
          </button>
        </div>
      </header>

      {/* Hotkeys / Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#091215] border-2 border-[#164034] rounded-lg max-w-xl w-full p-4 text-xs font-mono text-gray-300 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#164034] pb-2">
              <div className="text-sm font-bold text-[#00ffaa] flex items-center gap-2">
                <span>⌨️</span>
                <span>TACTICAL COCKPIT CONTROLS & HOTKEYS</span>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="space-y-1">
                <div className="text-[#00ffaa] font-bold border-b border-[#14282c] pb-0.5">CAMERA & SENSORS</div>
                <div><span className="text-white font-bold">Mouse Drag:</span> Pan 360° / Tilt ±60°</div>
                <div><span className="text-white font-bold">Click on Radar:</span> Slew sensor and lock contact</div>
                <div><span className="text-white font-bold">Key 1:</span> Daylight Optical (EO)</div>
                <div><span className="text-white font-bold">Key 2:</span> Night Vision NVG (Green)</div>
                <div><span className="text-white font-bold">Key 3:</span> FLIR Thermal (White-Hot)</div>
                <div><span className="text-white font-bold">Tab:</span> Cycle next air target</div>
              </div>

              <div className="space-y-1">
                <div className="text-[#00ffaa] font-bold border-b border-[#14282c] pb-0.5">ARSENAL & WEAPONS</div>
                <div><span className="text-white font-bold">Key Q:</span> Directional RF Jammer (Soft-Kill)</div>
                <div><span className="text-white font-bold">Key W:</span> 30mm Kinetic Flak (Hard-Kill)</div>
                <div><span className="text-white font-bold">Key E:</span> High-Energy Laser DEW</div>
                <div><span className="text-white font-bold">Key R:</span> Cyber GPS Spoofing</div>
                <div><span className="text-white font-bold">Spacebar:</span> Fire Active Weapon</div>
                <div><span className="text-white font-bold">Key A:</span> Open After-Action Review (AAR)</div>
              </div>
            </div>

            <div className="bg-[#0b1c20] p-2.5 rounded border border-[#143228] text-[10px] space-y-1 text-gray-300">
              <span className="text-[#ffaa00] font-bold block">RULES OF ENGAGEMENT (ROE) DOCTRINE:</span>
              <p>• Verify target classification in multi-spectrum optics before kinetic engagement.</p>
              <p>• Soft-kill RF Jamming and GPS Spoofing are prioritized when drones are near friendly facilities.</p>
              <p>• Kinetic flak bursts in designated civilian airspace result in instant mission penalties.</p>
            </div>

            <div className="text-right">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-1 bg-[#00ffaa] hover:bg-[#00e699] text-black rounded font-bold text-xs"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
