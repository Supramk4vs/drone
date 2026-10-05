import React from 'react';
import { WeaponType, SensorSpectrum, WeaponState, Drone } from '../types/tactical';

interface ArsenalControlBarProps {
  weapons: Record<WeaponType, WeaponState>;
  activeWeapon: WeaponType;
  onSelectWeapon: (type: WeaponType) => void;
  spectrum: SensorSpectrum;
  onSelectSpectrum: (spec: SensorSpectrum) => void;
  zoomLevel: number;
  onSelectZoom: (zoom: number) => void;
  isFiring: boolean;
  onStartFire: () => void;
  onStopFire: () => void;
  selectedDrone: Drone | null;
  onOpenAAR: () => void;
}

export const ArsenalControlBar: React.FC<ArsenalControlBarProps> = ({
  weapons,
  activeWeapon,
  onSelectWeapon,
  spectrum,
  onSelectSpectrum,
  zoomLevel,
  onSelectZoom,
  isFiring,
  onStartFire,
  onStopFire,
  selectedDrone,
  onOpenAAR,
}) => {
  const currentWp = weapons[activeWeapon];
  const isOutOfRange = selectedDrone ? selectedDrone.range > currentWp.effectiveRange : false;
  const isCooldown = currentWp.cooldownRemaining > 0;
  const isNoAmmo = currentWp.ammoOrCharge <= 0;
  const canFire = !isCooldown && !isNoAmmo && !!selectedDrone && selectedDrone.status !== 'DESTROYED';

  return (
    <div className="w-full h-12 bg-[#070e11] border-t border-[#14282c] px-2 sm:px-3 flex items-center justify-between text-xs font-mono select-none shadow-2xl shrink-0 gap-1.5 sm:gap-2 overflow-x-auto">
      {/* 1. Multi-Spectrum Optics & Zoom Selector */}
      <div className="flex items-center gap-0.5 sm:gap-1 bg-[#091518] p-0.5 rounded border border-[#14282c] shrink-0">
        {(['DAY', 'NVG', 'FLIR'] as SensorSpectrum[]).map((spec, i) => (
          <button
            key={spec}
            onClick={() => onSelectSpectrum(spec)}
            className={`px-1.5 sm:px-2 py-0.5 rounded font-bold transition-all text-[10px] sm:text-[11px] flex items-center gap-0.5 ${
              spectrum === spec
                ? 'bg-[#00ffaa] text-black shadow'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-[8.5px] opacity-75 hidden sm:inline">[{i + 1}]</span>
            <span>{spec}</span>
          </button>
        ))}

        <div className="h-3.5 w-[1px] bg-[#1a3830] mx-0.5" />

        {[1, 2, 4, 8].map((z) => (
          <button
            key={z}
            onClick={() => onSelectZoom(z)}
            className={`px-1 py-0.5 rounded text-[9.5px] sm:text-[10px] font-bold ${
              zoomLevel === z
                ? 'bg-[#ffaa00] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {z}X
          </button>
        ))}
      </div>

      {/* 2. Arsenal Weapons Selector (Compact & Touch Friendly) */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-1 max-w-xl justify-center shrink-0">
        {(Object.keys(weapons) as WeaponType[]).map((wKey) => {
          const w = weapons[wKey];
          const isSelected = activeWeapon === wKey;
          const isSoftKill = w.category === 'SOFT_KILL';
          const pct = Math.round((w.ammoOrCharge / w.maxAmmoOrCharge) * 100);

          return (
            <button
              key={wKey}
              onClick={() => onSelectWeapon(wKey)}
              className={`relative px-1.5 sm:px-2 py-1 rounded border transition-all flex flex-col flex-1 min-w-[70px] sm:min-w-[85px] max-w-[135px] text-left ${
                isSelected
                  ? 'bg-[#0c241e] border-[#00ffaa] text-[#00ffaa] shadow-md shadow-[#00ffaa]/20'
                  : 'bg-[#091518] border-[#14282c] text-gray-400 hover:border-gray-600 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-between w-full font-bold text-[9px] sm:text-[10px] leading-tight">
                <span className="truncate">{w.name.replace('DIR. ', '').replace('HIGH-ENERGY ', '')}</span>
                <span className="text-[8px] px-0.5 bg-black/50 text-gray-300 font-mono rounded hidden sm:inline">
                  {w.hotkey}
                </span>
              </div>

              {/* Mini Meter */}
              <div className="w-full bg-black/70 h-1 rounded mt-0.5 sm:mt-1 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isSoftKill ? 'bg-[#00d5ff]' : 'bg-[#ff3344]'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[8px] sm:text-[8.5px] mt-0.5 text-gray-400">
                <span className={isSoftKill ? 'text-[#00d5ff]' : 'text-[#ffaa00]'}>
                  {w.category === 'SOFT_KILL' ? 'SOFT' : 'HARD'}
                </span>
                <span>
                  {w.category === 'HARD_KILL' ? `${w.ammoOrCharge}R` : `${pct}%`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Action Engage Button & Status */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="text-right text-[10px] hidden md:block">
          <div className={`font-bold truncate max-w-[160px] ${
            !selectedDrone
              ? 'text-gray-500'
              : isOutOfRange
              ? 'text-[#ff3344]'
              : isCooldown
              ? 'text-[#ffaa00]'
              : isFiring
              ? 'text-[#00ffaa] animate-pulse'
              : 'text-[#00ffaa]'
          }`}>
            {!selectedDrone
              ? 'NO TARGET'
              : isOutOfRange
              ? `OUT OF RANGE`
              : isCooldown
              ? `COOLING (${currentWp.cooldownRemaining.toFixed(1)}s)`
              : isFiring
              ? 'FIRING...'
              : 'READY [SPACE]'}
          </div>
        </div>

        {/* FIRE BUTTON */}
        <button
          onMouseDown={canFire ? onStartFire : undefined}
          onMouseUp={onStopFire}
          onTouchStart={canFire ? onStartFire : undefined}
          onTouchEnd={onStopFire}
          disabled={!canFire}
          className={`px-3 sm:px-4 py-1.5 rounded font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center gap-1 sm:gap-1.5 ${
            canFire
              ? isFiring
                ? 'bg-[#ff3344] text-white shadow-[#ff3344]/50 animate-pulse'
                : 'bg-[#00ffaa] text-black hover:bg-[#00e699] active:scale-95 shadow-[#00ffaa]/30'
              : 'bg-[#152024] text-gray-600 cursor-not-allowed border border-[#1b2b30]'
          }`}
        >
          <span>⚡</span>
          <span>{isFiring ? 'ENGAGING' : 'FIRE'}</span>
          <span className="text-[9px] opacity-75 hidden lg:inline">[SPACE]</span>
        </button>

        {/* AAR Dossier Button */}
        <button
          onClick={onOpenAAR}
          className="px-2 sm:px-2.5 py-1.5 bg-[#0d222a] hover:bg-[#153440] border border-[#00bfff]/50 text-[#00bfff] rounded font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition-all"
        >
          <span>📋</span>
          <span className="hidden sm:inline">AAR</span>
          <span className="hidden md:inline">[A]</span>
        </button>
      </div>
    </div>
  );
};
