export type DroneType = 
  | 'FPV_SUICIDE'
  | 'COMMERCIAL_QUAD'
  | 'LOITERING_MUNITION'
  | 'HEAVY_HEXA_BOMBER'
  | 'SWARM_MICRO'
  | 'CIVILIAN_SURVEILLANCE';

export type DroneStatus = 
  | 'ACTIVE' 
  | 'JAMMED' 
  | 'SPOOFED' 
  | 'DESTROYED' 
  | 'CRASHING' 
  | 'DIVERTED';

export type WeaponType = 
  | 'RF_JAMMER' 
  | 'KINETIC_FLAK' 
  | 'LASER_DEW' 
  | 'GPS_SPOOF';

export type SensorSpectrum = 'DAY' | 'NVG' | 'FLIR';

export interface Drone {
  id: string;
  callsign: string;
  type: DroneType;
  position: [number, number, number]; // x, y (altitude), z in meters relative to base (0,0,0)
  velocity: [number, number, number];
  heading: number; // degrees 0-360
  speed: number; // m/s
  altitude: number; // m
  range: number; // m to base
  azimuth: number; // degrees from North (0-360)
  elevation: number; // degrees above horizon
  health: number; // 0-100
  laserHeat: number; // 0-100% heat accumulation
  thermalTemp: number; // degrees C
  rcs: number; // Radar Cross Section in m^2
  rfFreq: string; // e.g. "5.8 GHz" or "868 MHz"
  rfPowerDbm: number;
  protocol: string; // "ELRS 2.4G", "DJI Ocusync", "Crossfire", "Analog VTX"
  status: DroneStatus;
  isHostile: boolean;
  isIdentified: boolean;
  detectedTime: number; // seconds from sim start
  identifiedTime?: number;
  boidGroupId?: string;
  jamTimeRemaining?: number;
  spoofProgress?: number;
  payloadType: string;
  timeToImpact: number; // estimated seconds to reach base
}

export type RoEStatus = 'COMPLIANT' | 'VIOLATION' | 'SUB_OPTIMAL' | 'EXCELLENT';

export interface DecisionLogEntry {
  id: string;
  timestamp: number;
  droneId: string;
  droneCallsign: string;
  droneType: DroneType;
  actionTaken: WeaponType | 'VERIFY_OPTICS' | 'RADAR_DESIGNATE';
  roeStatus: RoEStatus;
  ruleTitle: string;
  reasoning: string;
  scoreDelta: number;
  collateralRisk: 'NONE' | 'LOW' | 'MODERATE' | 'CRITICAL';
}

export interface Scenario {
  id: string;
  code: string;
  title: string;
  location: string;
  description: string;
  environment: {
    timeOfDay: 'NIGHT' | 'DAY' | 'DUSK';
    fogDensity: number;
    recommendedOptics: SensorSpectrum;
  };
  roeGuidelines: string[];
  threatLevel: 'DEFCON 3' | 'DEFCON 2' | 'DEFCON 1' | 'TACTICAL RED';
  dronesConfig: Array<{
    type: DroneType;
    callsign: string;
    spawnPos: [number, number, number];
    isHostile: boolean;
    boidGroupId?: string;
    spawnDelaySec?: number;
  }>;
}

export interface WeaponState {
  type: WeaponType;
  name: string;
  category: 'SOFT_KILL' | 'HARD_KILL';
  effectiveRange: number; // meters
  ammoOrCharge: number; // count or percentage 0-100
  maxAmmoOrCharge: number;
  cooldownRemaining: number; // seconds
  cooldownMax: number;
  isFiring: boolean;
  hotkey: string;
  description: string;
}

export interface SimulationStats {
  simTime: number;
  baseHealth: number; // 100 to 0
  score: number;
  threatsDetected: number;
  threatsIdentified: number;
  threatsNeutralized: number;
  hostilesRemaining: number;
  totalHostiles: number;
  civiliansProtected: number;
  collateralViolations: number;
  avgTTD: number; // Time to detect (s)
  avgTTI: number; // Time to identify (s)
  roeCompliancePercent: number;
  accuracyPercent: number;
}
