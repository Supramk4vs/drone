import React from 'react';
import { Drone, DroneType } from '../types/tactical';

interface ThreatDetailsPanelProps {
  selectedDrone: Drone | null;
  onIdentifyDrone: (droneId: string, classifiedType: DroneType) => void;
}

export const ThreatDetailsPanel: React.FC<ThreatDetailsPanelProps> = ({
  selectedDrone,
  onIdentifyDrone,
}) => {
  if (!selectedDrone) {
    return (
      <div className="bg-[#070e10] border border-[#14282c] rounded p-3 select-none text-[11px] font-mono text-gray-500 flex flex-col items-center justify-center min-h-[160px]">
        <div className="w-8 h-8 rounded-full border border-dashed border-gray-700 flex items-center justify-center mb-1 text-sm">
          <span>🎯</span>
        </div>
        <div className="font-bold text-gray-400 text-xs">NO TARGET DESIGNATED</div>
        <div className="text-[9px] text-center text-gray-600 mt-0.5">
          Click an air track on the Radar or press [TAB]
        </div>
      </div>
    );
  }

  const getRecommendation = (d: Drone) => {
    if (d.status === 'JAMMED') return 'LINK SEVERED - MONITOR DESCENT';
    if (d.status === 'SPOOFED') return 'GNSS WAYPOINT SPOOF ACTIVE - HOLDING ORBIT';
    if (d.type === 'CIVILIAN_SURVEILLANCE') return 'WARNING: CIVILIAN AIR CORRIDOR. DO NOT ENGAGE.';
    if (d.range < 500 && d.speed > 35) return 'TERMINAL DIVE: FIRE 30mm KINETIC FLAK IMMEDIATELY.';
    if (d.type === 'COMMERCIAL_QUAD') return 'SOFT-KILL: DEPLOY DIRECTIONAL RF JAMMER.';
    if (d.type === 'SWARM_MICRO') return 'SWARM VECTOR: USE LASER DEW OR GPS CYBER SPOOF.';
    return 'DIRECTED ENERGY LASER RECOMMENDED FOR SURGICAL THERMAL KILL.';
  };

  return (
    <div className="bg-[#070e10] border border-[#14282c] rounded p-2 select-none text-[11px] font-mono shadow-md flex flex-col space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#14282c] pb-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            selectedDrone.status === 'JAMMED'
              ? 'bg-[#00d5ff]'
              : selectedDrone.status === 'SPOOFED'
              ? 'bg-[#ffaa00]'
              : selectedDrone.isHostile
              ? 'bg-[#ff3344] animate-ping'
              : 'bg-[#00ffaa]'
          }`} />
          <span className="font-bold text-white text-xs">{selectedDrone.callsign}</span>
          <span className="text-[9px] text-gray-400">({selectedDrone.id})</span>
        </div>
        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
          selectedDrone.isHostile
            ? 'bg-[#ff3344]/20 text-[#ff3344] border border-[#ff3344]/40'
            : 'bg-[#00ffaa]/20 text-[#00ffaa] border border-[#00ffaa]/40'
        }`}>
          {selectedDrone.status !== 'ACTIVE' ? selectedDrone.status : selectedDrone.isHostile ? 'HOSTILE' : 'CIVILIAN'}
        </span>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {/* Left Column: Dynamics */}
        <div className="bg-[#091518] p-1.5 rounded border border-[#12262b] space-y-0.5">
          <div className="text-[9px] text-gray-400 font-bold border-b border-[#14282c] pb-0.5">
            KINEMATICS
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">RANGE:</span>
            <span className="text-[#00ffaa] font-bold">{selectedDrone.range} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">ALTITUDE:</span>
            <span className="text-white">{selectedDrone.altitude} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">SPEED:</span>
            <span className="text-[#ffaa00]">{selectedDrone.speed} m/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">AZ / EL:</span>
            <span className="text-white">{selectedDrone.azimuth}° / {selectedDrone.elevation}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">TTI:</span>
            <span className={`font-bold ${
              selectedDrone.timeToImpact < 15 ? 'text-[#ff3344] animate-pulse' : 'text-[#ffaa00]'
            }`}>
              {selectedDrone.timeToImpact}s
            </span>
          </div>
        </div>

        {/* Right Column: Multi-Spectrum & EW */}
        <div className="bg-[#091518] p-1.5 rounded border border-[#12262b] space-y-0.5">
          <div className="text-[9px] text-gray-400 font-bold border-b border-[#14282c] pb-0.5">
            SIGNATURE
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">RADAR RCS:</span>
            <span className="text-white">{selectedDrone.rcs} m²</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">FLIR TEMP:</span>
            <span className="text-[#ffaa00] font-bold">{selectedDrone.thermalTemp}°C</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">PROTOCOL:</span>
            <span className="text-[#00d5ff] truncate max-w-[70px]">{selectedDrone.protocol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">CARRIER:</span>
            <span className="text-white">{selectedDrone.rfFreq}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">LASER HEAT:</span>
            <span className="text-[#ff3344] font-bold">{selectedDrone.laserHeat}%</span>
          </div>
        </div>
      </div>

      {/* Manual Classification Buttons */}
      {!selectedDrone.isIdentified && selectedDrone.status === 'ACTIVE' && (
        <div className="bg-[#0b1c18] p-1.5 rounded border border-[#143d30]">
          <div className="text-[9px] text-[#00ffaa] font-bold mb-1 flex items-center justify-between">
            <span>CLASSIFY FOR TTI SCORE:</span>
            <span className="text-gray-400 text-[8px]">ROE ARTICLE 3</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => onIdentifyDrone(selectedDrone.id, 'FPV_SUICIDE')}
              className="px-1 py-0.5 bg-[#143028] hover:bg-[#00ffaa] hover:text-black rounded text-[9px] font-bold text-gray-200 transition-all truncate"
            >
              FPV SUICIDE
            </button>
            <button
              onClick={() => onIdentifyDrone(selectedDrone.id, 'LOITERING_MUNITION')}
              className="px-1 py-0.5 bg-[#143028] hover:bg-[#00ffaa] hover:text-black rounded text-[9px] font-bold text-gray-200 transition-all truncate"
            >
              LOITERING
            </button>
            <button
              onClick={() => onIdentifyDrone(selectedDrone.id, 'CIVILIAN_SURVEILLANCE')}
              className="px-1 py-0.5 bg-[#143028] hover:bg-[#22cc88] hover:text-black rounded text-[9px] font-bold text-gray-200 transition-all truncate"
            >
              CIVILIAN
            </button>
          </div>
        </div>
      )}

      {/* Tactical Advisory Recommendation */}
      <div className="bg-[#08151c] p-1.5 rounded border border-[#112d3a] text-[9.5px] flex items-center gap-1.5">
        <span className="text-[#00ffaa] text-xs">💡</span>
        <div className="truncate w-full">
          <span className="text-gray-400 font-bold mr-1">ADVISORY:</span>
          <span className="text-gray-200">{getRecommendation(selectedDrone)}</span>
        </div>
      </div>
    </div>
  );
};
