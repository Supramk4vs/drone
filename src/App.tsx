/**
 * C-UAS TACTICAL SIMULATOR | Ministry of Defence - DSSC
 * AI-Enabled Drone & Counter-Drone Threat Simulation and Decision-Tree RoE Trainer
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Drone, 
  DroneType, 
  SensorSpectrum, 
  WeaponType, 
  WeaponState, 
  DecisionLogEntry, 
  SimulationStats, 
  Scenario 
} from './types/tactical';
import { SCENARIOS } from './data/scenarios';
import { boidsEngine } from './services/boidsEngine';
import { tacticalAudio } from './services/audioSynthesizer';
import { ScenarioHeader } from './components/ScenarioHeader';
import { TacticalViewport3D } from './components/TacticalViewport3D';
import { RadarPPI } from './components/RadarPPI';
import { RFWaterfallSpectrogram } from './components/RFWaterfallSpectrogram';
import { ThreatDetailsPanel } from './components/ThreatDetailsPanel';
import { DecisionTreeRoE } from './components/DecisionTreeRoE';
import { ArsenalControlBar } from './components/ArsenalControlBar';
import { AfterActionReviewModal } from './components/AfterActionReviewModal';

const INITIAL_WEAPONS: Record<WeaponType, WeaponState> = {
  RF_JAMMER: {
    type: 'RF_JAMMER',
    name: 'DIR. RF JAMMER',
    category: 'SOFT_KILL',
    effectiveRange: 2200,
    ammoOrCharge: 100,
    maxAmmoOrCharge: 100,
    cooldownRemaining: 0,
    cooldownMax: 1.5,
    isFiring: false,
    hotkey: 'Q',
    description: 'Directional conical electromagnetic beam severing 2.4/5.8GHz and ELRS telemetry.',
  },
  KINETIC_FLAK: {
    type: 'KINETIC_FLAK',
    name: '30mm CIWS FLAK',
    category: 'HARD_KILL',
    effectiveRange: 1500,
    ammoOrCharge: 120,
    maxAmmoOrCharge: 120,
    cooldownRemaining: 0,
    cooldownMax: 0.8,
    isFiring: false,
    hotkey: 'W',
    description: 'Point-defense timed fuze airburst shrapnel burst with lead calculation.',
  },
  LASER_DEW: {
    type: 'LASER_DEW',
    name: 'HIGH-ENERGY LASER',
    category: 'HARD_KILL',
    effectiveRange: 1800,
    ammoOrCharge: 100,
    maxAmmoOrCharge: 100,
    cooldownRemaining: 0,
    cooldownMax: 0.2,
    isFiring: false,
    hotkey: 'E',
    description: 'Continuous surgical directed photon thermal beam heating airframes to ignition.',
  },
  GPS_SPOOF: {
    type: 'GPS_SPOOF',
    name: 'CYBER GPS SPOOF',
    category: 'SOFT_KILL',
    effectiveRange: 2500,
    ammoOrCharge: 100,
    maxAmmoOrCharge: 100,
    cooldownRemaining: 0,
    cooldownMax: 3.0,
    isFiring: false,
    hotkey: 'R',
    description: 'Injects synthetic GNSS false coordinates forcing drones into safe holding orbit.',
  },
};

export default function App() {
  const [currentScenario, setCurrentScenario] = useState<Scenario>(SCENARIOS[0]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'RADAR' | 'THREAT' | 'DUAL'>('RADAR');
  const [mobileTab, setMobileTab] = useState<'VIEWPORT' | 'RADAR' | 'THREAT'>('VIEWPORT');

  // Time of Day (Morning / Night / Dusk) - Default to Morning Mode!
  const [timeOfDay, setTimeOfDay] = useState<'DAY' | 'NIGHT' | 'DUSK'>('DAY');

  // Optics & Viewport State - Day EO for Morning Mode!
  const [spectrum, setSpectrum] = useState<SensorSpectrum>('DAY');
  const [zoomLevel, setZoomLevel] = useState<number>(2);

  // Arsenal & Weapon State
  const [weapons, setWeapons] = useState<Record<WeaponType, WeaponState>>(INITIAL_WEAPONS);
  const [activeWeapon, setActiveWeapon] = useState<WeaponType>('RF_JAMMER');
  const [isFiring, setIsFiring] = useState<boolean>(false);

  // Decision Logs & RoE Audit
  const [decisionLogs, setDecisionLogs] = useState<DecisionLogEntry[]>([]);
  const [currentRoEStep, setCurrentRoEStep] = useState<number>(1);

  // Simulation Health & Metrics
  const [baseHealth, setBaseHealth] = useState<number>(100);
  const [score, setScore] = useState<number>(1000);
  const [simTime, setSimTime] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isAAROpen, setIsAAROpen] = useState<boolean>(false);

  // Stats Counters
  const [ttdList, setTtdList] = useState<number[]>([]);
  const [ttiList, setTtiList] = useState<number[]>([]);
  const [neutralizedCount, setNeutralizedCount] = useState<number>(0);
  const [collateralCount, setCollateralCount] = useState<number>(0);
  const [compliantRoECount, setCompliantRoECount] = useState<number>(0);
  const [totalRoEDecisions, setTotalRoEDecisions] = useState<number>(0);

  // Initialize Scenario Drones
  const initScenario = useCallback((scenario: Scenario) => {
    setCurrentScenario(scenario);
    const initTod = scenario.environment.timeOfDay || 'DAY';
    setTimeOfDay(initTod);
    setSpectrum(initTod === 'DAY' ? 'DAY' : scenario.environment.recommendedOptics);
    setZoomLevel(1);
    setBaseHealth(100);
    setScore(1000);
    setSimTime(0);
    setIsFiring(false);
    setDecisionLogs([]);
    setTtdList([]);
    setTtiList([]);
    setNeutralizedCount(0);
    setCollateralCount(0);
    setCompliantRoECount(0);
    setTotalRoEDecisions(0);
    setCurrentRoEStep(1);
    setWeapons(INITIAL_WEAPONS);

    const generatedDrones: Drone[] = scenario.dronesConfig.map((cfg, idx) => {
      const x = cfg.spawnPos[0];
      const y = cfg.spawnPos[1];
      const z = cfg.spawnPos[2];
      const dist = Math.sqrt(x * x + y * y + z * z);
      const speed = cfg.type === 'FPV_SUICIDE' ? 36 : cfg.type === 'LOITERING_MUNITION' ? 38 : cfg.type === 'SWARM_MICRO' ? 30 : 18;

      let rcs = 0.05;
      let freq = '5.8 GHz';
      let protocol = 'ELRS 2.4G';
      let thermal = 52;
      let payload = '1.5kg High-Explosive Shaped Charge';

      if (cfg.type === 'COMMERCIAL_QUAD') {
        rcs = 0.12;
        freq = '2.4 GHz';
        protocol = 'DJI O3 Air Unit';
        thermal = 38;
        payload = '4K Gimbal EO Optical Camera';
      } else if (cfg.type === 'HEAVY_HEXA_BOMBER') {
        rcs = 0.35;
        freq = '868 MHz';
        protocol = 'Crossfire Telemetry';
        thermal = 65;
        payload = '3x 82mm Droppable Mortar Shells';
      } else if (cfg.type === 'CIVILIAN_SURVEILLANCE') {
        rcs = 0.08;
        freq = '5.8 GHz';
        protocol = 'Standard Wi-Fi C2';
        thermal = 32;
        payload = 'Civilian Media Camera (Non-Threat)';
      }

      return {
        id: `trk_${idx + 1}`,
        callsign: cfg.callsign,
        type: cfg.type,
        position: [x, y, z],
        velocity: [-(x / dist) * speed, -(y / dist) * speed * 0.2, -(z / dist) * speed],
        heading: Math.round(Math.atan2(-x, z) * (180 / Math.PI) + 360) % 360,
        speed,
        altitude: Math.round(y),
        range: Math.round(dist),
        azimuth: Math.round(Math.atan2(x, -z) * (180 / Math.PI) + 360) % 360,
        elevation: Math.round(Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI)),
        health: 100,
        laserHeat: 0,
        thermalTemp: thermal,
        rcs,
        rfFreq: freq,
        rfPowerDbm: -45,
        protocol,
        status: 'ACTIVE',
        isHostile: cfg.isHostile,
        isIdentified: false,
        detectedTime: 0,
        boidGroupId: cfg.boidGroupId,
        payloadType: payload,
        timeToImpact: Math.round(dist / speed),
      };
    });

    setDrones(generatedDrones);
    if (generatedDrones.length > 0) {
      setSelectedDroneId(generatedDrones[0].id);
    }

    tacticalAudio.speak(`Scenario initiated. ${scenario.title}. Standby for radar contacts.`);
  }, []);

  // Initial load
  useEffect(() => {
    initScenario(SCENARIOS[0]);
  }, [initScenario]);

  // Main Simulation Tick Loop (60 FPS / requestAnimationFrame or Interval)
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const deltaSec = 0.05; // 50ms tick (20Hz physics update)

      setSimTime((prev) => prev + deltaSec);

      // Cooldown decrement for weapons
      setWeapons((prev) => {
        let updated = false;
        const next = { ...prev };
        (Object.keys(next) as WeaponType[]).forEach((wKey) => {
          if (next[wKey].cooldownRemaining > 0) {
            next[wKey].cooldownRemaining = Math.max(0, next[wKey].cooldownRemaining - deltaSec);
            updated = true;
          }
        });
        return updated ? next : prev;
      });

      // Update Boids swarm kinetics & flight physics
      setDrones((prevDrones) => {
        const updated = boidsEngine.updateSwarm(prevDrones, deltaSec, [0, 5, 0]);

        // Check if any hostile reached FOB defensive perimeter (<= 25m)
        updated.forEach((drone) => {
          if (drone.status === 'ACTIVE' && drone.range <= 30) {
            drone.status = 'DESTROYED';
            drone.health = 0;

            if (drone.isHostile) {
              // Base explosion damage!
              const dmg = drone.type === 'HEAVY_HEXA_BOMBER' ? 35 : 20;
              setBaseHealth((hp) => Math.max(0, hp - dmg));
              setScore((sc) => Math.max(0, sc - 300));
              tacticalAudio.playDroneExplosion();
              tacticalAudio.playAlarmKlaxon();
              tacticalAudio.speak('Warning! Perimeter Breach! Base Damaged!');

              // Log penalty
              logRoEDecision({
                droneId: drone.id,
                droneCallsign: drone.callsign,
                droneType: drone.type,
                actionTaken: 'RADAR_DESIGNATE',
                roeStatus: 'VIOLATION',
                ruleTitle: 'PERIMETER DEFENSE BREACH',
                reasoning: `Hostile ${drone.callsign} breached 30m perimeter before neutralization. -300 pts.`,
                scoreDelta: -300,
                collateralRisk: 'CRITICAL',
              });
            }
          }

          // Handle continuous Laser damage
          if (isFiring && activeWeapon === 'LASER_DEW' && drone.id === selectedDroneId && drone.status === 'ACTIVE') {
            drone.laserHeat = Math.min(100, drone.laserHeat + 40 * deltaSec); // 2.5 seconds to burn
            if (drone.laserHeat >= 100) {
              drone.status = 'DESTROYED';
              drone.health = 0;
              handleNeutralizeSuccess(drone, 'LASER_DEW');
            }
          }
        });

        return updated;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPaused, isFiring, activeWeapon, selectedDroneId]);

  // Handle Weapon Fire Trigger
  const handleStartFire = () => {
    const currentWp = weapons[activeWeapon];
    if (currentWp.cooldownRemaining > 0 || currentWp.ammoOrCharge <= 0) return;

    const selectedDrone = drones.find((d) => d.id === selectedDroneId);
    if (!selectedDrone || selectedDrone.status !== 'ACTIVE') return;

    if (selectedDrone.range > currentWp.effectiveRange) return;

    setIsFiring(true);

    // 1. RF DIRECTIONAL JAMMER
    if (activeWeapon === 'RF_JAMMER') {
      tacticalAudio.playJammerPulse();
      setWeapons((prev) => ({
        ...prev,
        RF_JAMMER: {
          ...prev.RF_JAMMER,
          cooldownRemaining: prev.RF_JAMMER.cooldownMax,
          ammoOrCharge: Math.max(0, prev.RF_JAMMER.ammoOrCharge - 15),
        },
      }));

      // Jam the drone after brief beam duration
      setTimeout(() => {
        setDrones((prev) =>
          prev.map((d) => {
            if (d.id === selectedDrone.id && d.status === 'ACTIVE') {
              handleNeutralizeSuccess(d, 'RF_JAMMER');
              return { ...d, status: 'JAMMED' };
            }
            return d;
          })
        );
        setIsFiring(false);
      }, 500);
    }

    // 2. 30mm KINETIC FLAK CIWS
    if (activeWeapon === 'KINETIC_FLAK') {
      tacticalAudio.playFlakShot();
      setWeapons((prev) => ({
        ...prev,
        KINETIC_FLAK: {
          ...prev.KINETIC_FLAK,
          cooldownRemaining: prev.KINETIC_FLAK.cooldownMax,
          ammoOrCharge: Math.max(0, prev.KINETIC_FLAK.ammoOrCharge - 4),
        },
      }));

      // Airburst hits after bullet flight time
      setTimeout(() => {
        setDrones((prev) =>
          prev.map((d) => {
            if (d.id === selectedDrone.id && d.status === 'ACTIVE') {
              handleNeutralizeSuccess(d, 'KINETIC_FLAK');
              return { ...d, status: 'DESTROYED', health: 0 };
            }
            return d;
          })
        );
        setIsFiring(false);
      }, 350);
    }

    // 3. HIGH-ENERGY LASER DEW
    if (activeWeapon === 'LASER_DEW') {
      tacticalAudio.startLaser();
      setWeapons((prev) => ({
        ...prev,
        LASER_DEW: {
          ...prev.LASER_DEW,
          ammoOrCharge: Math.max(0, prev.LASER_DEW.ammoOrCharge - 1),
        },
      }));
    }

    // 4. CYBER GPS SPOOFING
    if (activeWeapon === 'GPS_SPOOF') {
      tacticalAudio.playSpoofChirp();
      setWeapons((prev) => ({
        ...prev,
        GPS_SPOOF: {
          ...prev.GPS_SPOOF,
          cooldownRemaining: prev.GPS_SPOOF.cooldownMax,
          ammoOrCharge: Math.max(0, prev.GPS_SPOOF.ammoOrCharge - 25),
        },
      }));

      setTimeout(() => {
        setDrones((prev) =>
          prev.map((d) => {
            if (d.id === selectedDrone.id && d.status === 'ACTIVE') {
              handleNeutralizeSuccess(d, 'GPS_SPOOF');
              return { ...d, status: 'SPOOFED' };
            }
            return d;
          })
        );
        setIsFiring(false);
      }, 600);
    }
  };

  const handleStopFire = () => {
    if (activeWeapon === 'LASER_DEW') {
      tacticalAudio.stopLaser();
    }
    setIsFiring(false);
  };

  // Neutralization Success & RoE Compliance Scoring
  const handleNeutralizeSuccess = (target: Drone, weaponUsed: WeaponType) => {
    tacticalAudio.playDroneExplosion();

    // Check if target is civilian or hostile
    if (!target.isHostile) {
      // Catastrophic RoE Civilian Violation!
      setCollateralCount((c) => c + 1);
      setScore((s) => Math.max(0, s - 500));
      tacticalAudio.speak('Cease fire! Collateral violation! Non-hostile aircraft destroyed.');

      logRoEDecision({
        droneId: target.id,
        droneCallsign: target.callsign,
        droneType: target.type,
        actionTaken: weaponUsed,
        roeStatus: 'VIOLATION',
        ruleTitle: 'CIVILIAN AIR CORRIDOR BREACH',
        reasoning: `Kinetic destruction of civilian airframe ${target.callsign}. Violation of Article 4 Rules of Engagement. -500 pts.`,
        scoreDelta: -500,
        collateralRisk: 'CRITICAL',
      });
      return;
    }

    // Valid Hostile Neutralization
    setNeutralizedCount((n) => n + 1);
    tacticalAudio.speak(`${target.callsign} Neutralized.`);

    let pts = 250;
    let roeStatus: DecisionLogEntry['roeStatus'] = 'COMPLIANT';
    let reasoning = `Threat neutralized with ${weaponUsed}.`;

    if (weaponUsed === 'RF_JAMMER') {
      pts = 350;
      roeStatus = 'EXCELLENT';
      reasoning = `Soft-kill RF Jammer successfully disrupted C2 telemetry without explosive debris. +350 pts.`;
    } else if (weaponUsed === 'GPS_SPOOF') {
      pts = 300;
      roeStatus = 'EXCELLENT';
      reasoning = `GPS Spoofing diverted swarm navigation vector into designated safety corridor. +300 pts.`;
    } else if (weaponUsed === 'LASER_DEW') {
      pts = 280;
      roeStatus = 'COMPLIANT';
      reasoning = `Directed Energy Laser thermal burn prevented warhead detonation. +280 pts.`;
    } else {
      pts = 220;
      roeStatus = 'COMPLIANT';
      reasoning = `30mm Flak airburst shattered incoming airframe. +220 pts.`;
    }

    setScore((s) => s + pts);
    setCompliantRoECount((c) => c + 1);

    logRoEDecision({
      droneId: target.id,
      droneCallsign: target.callsign,
      droneType: target.type,
      actionTaken: weaponUsed,
      roeStatus,
      ruleTitle: 'PROPORTIONAL THREAT NEUTRALIZATION',
      reasoning,
      scoreDelta: pts,
      collateralRisk: 'NONE',
    });
  };

  // Manual Classification by Operator
  const handleIdentifyDrone = (droneId: string, classifiedType: DroneType) => {
    setDrones((prev) =>
      prev.map((d) => {
        if (d.id === droneId) {
          const tti = Math.round(simTime);
          setTtiList((list) => [...list, tti]);

          const isCorrect = d.type === classifiedType || (d.isHostile && classifiedType !== 'CIVILIAN_SURVEILLANCE');

          const pts = isCorrect ? 150 : -100;
          setScore((s) => Math.max(0, s + pts));

          logRoEDecision({
            droneId: d.id,
            droneCallsign: d.callsign,
            droneType: classifiedType,
            actionTaken: 'VERIFY_OPTICS',
            roeStatus: isCorrect ? 'COMPLIANT' : 'SUB_OPTIMAL',
            ruleTitle: isCorrect ? 'POSITIVE IDENTIFICATION (PID) CONFIRMED' : 'MISCLASSIFICATION PENALTY',
            reasoning: isCorrect
              ? `Multi-spectrum sensor verification verified ${classifiedType}. TTI: ${tti}s. +150 pts.`
              : `Inaccurate visual identification against sensor cross-reference. -100 pts.`,
            scoreDelta: pts,
            collateralRisk: 'LOW',
          });

          return { ...d, isIdentified: true, identifiedTime: tti };
        }
        return d;
      })
    );
    setCurrentRoEStep(3);
  };

  // Helper: Log RoE Decision
  const logRoEDecision = (entry: Omit<DecisionLogEntry, 'id' | 'timestamp'>) => {
    setTotalRoEDecisions((prev) => prev + 1);
    const newEntry: DecisionLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Math.round(simTime),
    };
    setDecisionLogs((prev) => [newEntry, ...prev]);
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const key = e.key.toUpperCase();

      // Optics Hotkeys
      if (key === '1') setSpectrum('DAY');
      else if (key === '2') setSpectrum('NVG');
      else if (key === '3') setSpectrum('FLIR');

      // Weapon Hotkeys
      else if (key === 'Q') setActiveWeapon('RF_JAMMER');
      else if (key === 'W') setActiveWeapon('KINETIC_FLAK');
      else if (key === 'E') setActiveWeapon('LASER_DEW');
      else if (key === 'R') setActiveWeapon('GPS_SPOOF');

      // Fire Weapon Hotkey
      else if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleStartFire();
      }

      // Target Cycle Hotkey (TAB)
      else if (key === 'TAB') {
        e.preventDefault();
        const activeTracks = drones.filter((d) => d.status !== 'DESTROYED');
        if (activeTracks.length > 0) {
          const currentIdx = activeTracks.findIndex((d) => d.id === selectedDroneId);
          const nextIdx = (currentIdx + 1) % activeTracks.length;
          setSelectedDroneId(activeTracks[nextIdx].id);
          tacticalAudio.playLockAcquired();
        }
      }

      // After-Action Review (A)
      else if (key === 'A') {
        setIsAAROpen((prev) => !prev);
      }

      // Close modal (Escape)
      else if (e.key === 'Escape') {
        setIsAAROpen(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        handleStopFire();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  // Calculate Aggregated Metrics
  const activeHostiles = drones.filter((d) => d.status === 'ACTIVE' && d.isHostile).length;
  const avgTTD = ttdList.length > 0 ? ttdList.reduce((a, b) => a + b, 0) / ttdList.length : 3.8;
  const avgTTI = ttiList.length > 0 ? ttiList.reduce((a, b) => a + b, 0) / ttiList.length : 7.4;
  const roeCompliancePercent = totalRoEDecisions > 0 ? Math.round((compliantRoECount / totalRoEDecisions) * 100) : 100;
  const accuracyPercent = 88;

  const simStats: SimulationStats = {
    simTime,
    baseHealth,
    score,
    threatsDetected: drones.length,
    threatsIdentified: drones.filter((d) => d.isIdentified).length,
    threatsNeutralized: neutralizedCount,
    hostilesRemaining: activeHostiles,
    totalHostiles: currentScenario.dronesConfig.filter((d) => d.isHostile).length,
    civiliansProtected: drones.filter((d) => !d.isHostile && d.status !== 'DESTROYED').length,
    collateralViolations: collateralCount,
    avgTTD,
    avgTTI,
    roeCompliancePercent,
    accuracyPercent,
  };

  const handleToggleTimeOfDay = (newTod: 'DAY' | 'NIGHT' | 'DUSK') => {
    setTimeOfDay(newTod);
    if (newTod === 'DAY') {
      setSpectrum('DAY');
      tacticalAudio.speak('Morning daylight mode activated.');
    } else if (newTod === 'NIGHT') {
      if (spectrum === 'DAY') setSpectrum('FLIR');
      tacticalAudio.speak('Night mode activated.');
    }
  };

  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070b0c] text-[#d1fae5] select-none font-mono">
      {/* 1. Header Bar */}
      <ScenarioHeader
        scenarios={SCENARIOS}
        currentScenario={currentScenario}
        onSelectScenario={initScenario}
        baseHealth={baseHealth}
        simTime={simTime}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused(!isPaused)}
        onResetSim={() => initScenario(currentScenario)}
        threatsRemaining={drones.filter((d) => d.status !== 'DESTROYED').length}
        score={score}
        timeOfDay={timeOfDay}
        onToggleTimeOfDay={handleToggleTimeOfDay}
      />

      {/* 2. Main Tactical Center Layout: Responsive Mobile & Laptop Mode */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">
        {/* Mobile View Switcher Dock (Visible only on mobile/tablet screens < 1024px) */}
        <div className="lg:hidden flex items-center justify-around bg-[#070e11] border-b border-[#14282c] p-1 text-[10px] font-bold shrink-0 z-20">
          <button
            onClick={() => setMobileTab('VIEWPORT')}
            className={`flex-1 py-1 rounded mx-0.5 text-center transition-all ${
              mobileTab === 'VIEWPORT'
                ? 'bg-[#00ffaa] text-black shadow'
                : 'text-gray-400 hover:text-white bg-[#0a181c]'
            }`}
          >
            👁️ 3D VIEW
          </button>
          <button
            onClick={() => setMobileTab('RADAR')}
            className={`flex-1 py-1 rounded mx-0.5 text-center transition-all ${
              mobileTab === 'RADAR'
                ? 'bg-[#00ffaa] text-black shadow'
                : 'text-gray-400 hover:text-white bg-[#0a181c]'
            }`}
          >
            📡 RADAR & EW
          </button>
          <button
            onClick={() => setMobileTab('THREAT')}
            className={`flex-1 py-1 rounded mx-0.5 text-center transition-all ${
              mobileTab === 'THREAT'
                ? 'bg-[#00ffaa] text-black shadow'
                : 'text-gray-400 hover:text-white bg-[#0a181c]'
            }`}
          >
            🎯 TARGET & ROE
          </button>
        </div>

        {/* 3D Tactical Battlefield Viewport */}
        <div className={`relative flex-1 min-w-0 ${
          mobileTab !== 'VIEWPORT' ? 'hidden lg:flex' : 'flex'
        }`}>
          <TacticalViewport3D
            drones={drones}
            selectedDroneId={selectedDroneId}
            onSelectDrone={(id) => {
              setSelectedDroneId(id);
              tacticalAudio.playLockAcquired();
            }}
            spectrum={spectrum}
            zoomLevel={zoomLevel}
            activeWeapon={activeWeapon}
            isFiring={isFiring}
            timeOfDay={timeOfDay}
          />
        </div>

        {/* Right Tactical Sidebar Panels */}
        <div className={`w-full lg:w-[300px] xl:w-[325px] bg-[#070d0f] border-t lg:border-t-0 lg:border-l border-[#14282c] flex flex-col p-2 gap-2 overflow-y-auto z-10 shadow-2xl shrink-0 ${
          mobileTab === 'VIEWPORT' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Tactical Dock Tab Switcher (Desktop) */}
          <div className="hidden lg:grid grid-cols-3 gap-1 bg-[#091518] p-0.5 rounded border border-[#14282c] text-[10px] font-bold">
            <button
              onClick={() => setSidebarTab('RADAR')}
              className={`py-1 rounded transition-all text-center ${
                sidebarTab === 'RADAR'
                  ? 'bg-[#00ffaa] text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              RADAR & EW
            </button>
            <button
              onClick={() => setSidebarTab('THREAT')}
              className={`py-1 rounded transition-all text-center ${
                sidebarTab === 'THREAT'
                  ? 'bg-[#00ffaa] text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              TARGET & ROE
            </button>
            <button
              onClick={() => setSidebarTab('DUAL')}
              className={`py-1 rounded transition-all text-center ${
                sidebarTab === 'DUAL'
                  ? 'bg-[#00ffaa] text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              DUAL VIEW
            </button>
          </div>

          {/* Radar & EW Section */}
          {((sidebarTab === 'RADAR' || sidebarTab === 'DUAL') || mobileTab === 'RADAR') && (
            <div className={`flex flex-col gap-2 ${mobileTab === 'THREAT' ? 'hidden lg:flex' : ''}`}>
              {/* Radar PPI Screen */}
              <RadarPPI
                drones={drones}
                selectedDroneId={selectedDroneId}
                onSelectDrone={(id) => setSelectedDroneId(id)}
                maxRangeMeters={3000}
              />

              {/* Real-time RF Waterfall Spectrogram */}
              <RFWaterfallSpectrogram
                drones={drones}
                selectedDroneId={selectedDroneId}
              />
            </div>
          )}

          {/* Threat & RoE Section */}
          {((sidebarTab === 'THREAT' || sidebarTab === 'DUAL') || mobileTab === 'THREAT') && (
            <div className={`flex flex-col gap-2 ${mobileTab === 'RADAR' ? 'hidden lg:flex' : ''}`}>
              {/* Threat Details & Telemetry */}
              <ThreatDetailsPanel
                selectedDrone={selectedDrone}
                onIdentifyDrone={handleIdentifyDrone}
              />

              {/* Explainable RoE Decision-Tree */}
              <DecisionTreeRoE
                decisionLogs={decisionLogs}
                complianceScore={roeCompliancePercent}
                currentStep={currentRoEStep}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Arsenal Control Bar */}
      <ArsenalControlBar
        weapons={weapons}
        activeWeapon={activeWeapon}
        onSelectWeapon={(wp) => setActiveWeapon(wp)}
        spectrum={spectrum}
        onSelectSpectrum={(spec) => setSpectrum(spec)}
        zoomLevel={zoomLevel}
        onSelectZoom={(z) => setZoomLevel(z)}
        isFiring={isFiring}
        onStartFire={handleStartFire}
        onStopFire={handleStopFire}
        selectedDrone={selectedDrone}
        onOpenAAR={() => setIsAAROpen(true)}
      />

      {/* 4. After-Action Review (AAR) & DSSC Form-904 Dossier Modal */}
      <AfterActionReviewModal
        isOpen={isAAROpen}
        onClose={() => setIsAAROpen(false)}
        stats={simStats}
        decisionLogs={decisionLogs}
        currentScenario={currentScenario}
      />
    </div>
  );
}
