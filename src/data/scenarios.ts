import { Scenario } from '../types/tactical';

export const SCENARIOS: Scenario[] = [
  {
    id: 'op_night_watch',
    code: 'NW-904',
    title: 'Operation Night Watch',
    location: 'Forward Base Sector 4 (Himalayan Ridge Line)',
    description: 'Under cover of midnight darkness and light alpine haze, multiple hostile low-RCS loitering munitions and FPV kamikaze drones attempt an ingress. Trainees must switch between NVG Green Phosphor and FLIR Thermal to acquire battery heat signatures.',
    environment: {
      timeOfDay: 'NIGHT',
      fogDensity: 0.0018,
      recommendedOptics: 'FLIR',
    },
    threatLevel: 'DEFCON 2',
    roeGuidelines: [
      '1. Verify thermal signature > 45°C prior to kinetic fire to prevent fratricide.',
      '2. Neutralize high-speed FPV diving vectors before they cross the 500m defensive perimeter.',
      '3. Conserve 30mm flak ammunition for terminal engagements; employ Directed Energy / RF Jammer at long range.'
    ],
    dronesConfig: [
      {
        type: 'LOITERING_MUNITION',
        callsign: 'SPECTRE-01',
        spawnPos: [-1200, 280, -1800],
        isHostile: true,
      },
      {
        type: 'FPV_SUICIDE',
        callsign: 'VIPER-01',
        spawnPos: [950, 160, -1400],
        isHostile: true,
      },
      {
        type: 'FPV_SUICIDE',
        callsign: 'VIPER-02',
        spawnPos: [1100, 190, -1350],
        isHostile: true,
      },
      {
        type: 'COMMERCIAL_QUAD',
        callsign: 'SCOUT-09',
        spawnPos: [-600, 120, -1100],
        isHostile: true,
      },
      {
        type: 'LOITERING_MUNITION',
        callsign: 'SPECTRE-02',
        spawnPos: [400, 310, -2100],
        isHostile: true,
      }
    ]
  },
  {
    id: 'border_outpost',
    code: 'BO-412',
    title: 'Border Outpost Incursion',
    location: 'High-Altitude Forward Air Base',
    description: 'Adversary deployment of modified commercial heavy-lift drones carrying improvised shaped charges alongside electronic surveillance quadcopters.',
    environment: {
      timeOfDay: 'DUSK',
      fogDensity: 0.0008,
      recommendedOptics: 'NVG',
    },
    threatLevel: 'DEFCON 3',
    roeGuidelines: [
      '1. Soft-kill RF Jamming prioritized on 2.4/5.8 GHz control links to force commercial drone landing.',
      '2. Heavy Hexacopter bombers must be neutralized before releasing ordnance on command bunker.',
      '3. Beware of secondary explosive fragmentation upon kinetic flak detonation.'
    ],
    dronesConfig: [
      {
        type: 'COMMERCIAL_QUAD',
        callsign: 'MAVIC-ALPHA',
        spawnPos: [-700, 140, -900],
        isHostile: true,
      },
      {
        type: 'HEAVY_HEXA_BOMBER',
        callsign: 'GOLIATH-01',
        spawnPos: [1400, 240, -1600],
        isHostile: true,
      },
      {
        type: 'FPV_SUICIDE',
        callsign: 'DART-01',
        spawnPos: [-300, 90, -1200],
        isHostile: true,
      },
      {
        type: 'COMMERCIAL_QUAD',
        callsign: 'MAVIC-BRAVO',
        spawnPos: [850, 110, -850],
        isHostile: true,
      }
    ]
  },
  {
    id: 'swarm_saturation',
    code: 'SW-880',
    title: 'Swarm Saturation Assault',
    location: 'Coastal Strategic Radar Array',
    description: 'A coordinated autonomous micro-drone swarm utilizing decentralized Boids flocking algorithms to saturate defensive fire channels. Demonstrates leaderless swarm resilience and adaptive pathfinding.',
    environment: {
      timeOfDay: 'DAY',
      fogDensity: 0.0004,
      recommendedOptics: 'DAY',
    },
    threatLevel: 'TACTICAL RED',
    roeGuidelines: [
      '1. High-Energy Laser DEW effective for rapid thermal takedown without collateral airburst debris.',
      '2. Wide-band GPS spoofing bubble disrupts boid synchronized GNSS positioning grid.',
      '3. Terminal dive triggers when swarm breaches 400m; prioritize leaders with highest velocity vector.'
    ],
    dronesConfig: Array.from({ length: 12 }).map((_, i) => ({
      type: 'SWARM_MICRO',
      callsign: `SWARM-${(i + 1).toString().padStart(2, '0')}`,
      spawnPos: [
        -350 + (i % 4) * 120 + (Math.random() * 40 - 20),
        110 + Math.floor(i / 4) * 35 + (Math.random() * 20 - 10),
        -1600 - (i * 45) + (Math.random() * 60 - 30)
      ] as [number, number, number],
      isHostile: true,
      boidGroupId: 'SWARM_GROUP_1'
    }))
  },
  {
    id: 'urban_collateral',
    code: 'UC-109',
    title: 'Urban Perimeter & Collateral Challenge',
    location: 'Metropolitan Perimeter Security Zone',
    description: 'Sensors detect multiple air contacts in the vicinity of an urban civilian airport corridor. Trainees must rigorously verify targets via multi-spectrum cameras before firing to avoid catastrophic civilian collateral damage.',
    environment: {
      timeOfDay: 'DAY',
      fogDensity: 0.0003,
      recommendedOptics: 'DAY',
    },
    threatLevel: 'DEFCON 3',
    roeGuidelines: [
      '1. STRICT ROE: Civilian media/courier drones are operating in designated Green Corridor. Do NOT engage with kinetic weapons.',
      '2. Verify IFF and Visual Classification before weapons release.',
      '3. Any kinetic engagement of unconfirmed contact results in instant DSSC RoE failure penalty.'
    ],
    dronesConfig: [
      {
        type: 'CIVILIAN_SURVEILLANCE',
        callsign: 'CIV-AIR-42',
        spawnPos: [650, 180, -950],
        isHostile: false, // Friendly / Civilian!
      },
      {
        type: 'FPV_SUICIDE',
        callsign: 'INTRUDER-X',
        spawnPos: [-800, 140, -1300],
        isHostile: true,
      },
      {
        type: 'CIVILIAN_SURVEILLANCE',
        callsign: 'METRO-NEWS-01',
        spawnPos: [-500, 210, -750],
        isHostile: false, // Friendly / Civilian!
      },
      {
        type: 'LOITERING_MUNITION',
        callsign: 'SHADOW-99',
        spawnPos: [1100, 270, -1700],
        isHostile: true,
      }
    ]
  }
];
