import { Drone } from '../types/tactical';

interface BoidParams {
  separationDistance: number;
  neighborDistance: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
  goalWeight: number;
  maxSpeed: number;
  maxForce: number;
}

const DEFAULT_BOID_PARAMS: BoidParams = {
  separationDistance: 35,
  neighborDistance: 120,
  separationWeight: 1.6,
  alignmentWeight: 1.0,
  cohesionWeight: 0.9,
  goalWeight: 1.8,
  maxSpeed: 38, // m/s
  maxForce: 15,
};

export class SwarmBoidsEngine {
  private params: BoidParams;

  constructor(customParams?: Partial<BoidParams>) {
    this.params = { ...DEFAULT_BOID_PARAMS, ...customParams };
  }

  /**
   * Updates an entire swarm array using Reynolds flocking + mission goals + threat evasion
   */
  public updateSwarm(drones: Drone[], deltaSec: number, targetBase: [number, number, number] = [0, 5, 0]): Drone[] {
    const updated = drones.map((drone) => ({ ...drone }));

    // Group by boid group
    const groups: { [key: string]: Drone[] } = {};
    updated.forEach((d) => {
      if (d.boidGroupId && d.status === 'ACTIVE') {
        if (!groups[d.boidGroupId]) groups[d.boidGroupId] = [];
        groups[d.boidGroupId].push(d);
      }
    });

    for (let i = 0; i < updated.length; i++) {
      const drone = updated[i];

      // Handle non-active or disabled drones
      if (drone.status === 'DESTROYED') continue;

      if (drone.status === 'CRASHING') {
        drone.position[1] = Math.max(0, drone.position[1] - 45 * deltaSec);
        drone.position[0] += drone.velocity[0] * deltaSec * 0.4;
        drone.position[2] += drone.velocity[2] * deltaSec * 0.4;
        if (drone.position[1] <= 1) {
          drone.status = 'DESTROYED';
          drone.health = 0;
        }
        this.updateDerivedTelemetry(drone);
        continue;
      }

      if (drone.status === 'JAMMED') {
        // Drone enters failsafe hover & erratic descent
        drone.velocity[0] *= 0.85;
        drone.velocity[2] *= 0.85;
        drone.velocity[1] = -4; // drift downward slowly
        drone.position[0] += drone.velocity[0] * deltaSec;
        drone.position[1] = Math.max(0, drone.position[1] + drone.velocity[1] * deltaSec);
        drone.position[2] += drone.velocity[2] * deltaSec;
        if (drone.position[1] <= 0.5) {
          drone.status = 'DIVERTED';
        }
        this.updateDerivedTelemetry(drone);
        continue;
      }

      if (drone.status === 'SPOOFED') {
        // Orbit around decoy waypoint in safe zone (+800m East, +600m South)
        const decoyX = 800;
        const decoyZ = -700;
        const dx = decoyX - drone.position[0];
        const dz = decoyZ - drone.position[2];
        const angle = Math.atan2(dz, dx) + Math.PI / 2; // orbit tangential
        drone.velocity[0] = Math.cos(angle) * 18;
        drone.velocity[2] = Math.sin(angle) * 18;
        drone.velocity[1] = (70 - drone.position[1]) * 0.2; // maintain safe transit alt
        drone.position[0] += drone.velocity[0] * deltaSec;
        drone.position[1] += drone.velocity[1] * deltaSec;
        drone.position[2] += drone.velocity[2] * deltaSec;
        this.updateDerivedTelemetry(drone);
        continue;
      }

      // If part of a swarm boid group
      if (drone.boidGroupId && groups[drone.boidGroupId]?.length > 1) {
        const flock = groups[drone.boidGroupId];
        const accel = this.computeFlockingAcceleration(drone, flock, targetBase);

        // Apply acceleration
        drone.velocity[0] += accel[0] * deltaSec;
        drone.velocity[1] += accel[1] * deltaSec;
        drone.velocity[2] += accel[2] * deltaSec;

        // Cap speed
        const speed = Math.sqrt(
          drone.velocity[0] ** 2 + drone.velocity[1] ** 2 + drone.velocity[2] ** 2
        );
        if (speed > this.params.maxSpeed) {
          drone.velocity[0] = (drone.velocity[0] / speed) * this.params.maxSpeed;
          drone.velocity[1] = (drone.velocity[1] / speed) * this.params.maxSpeed;
          drone.velocity[2] = (drone.velocity[2] / speed) * this.params.maxSpeed;
        }
      } else {
        // Single drone behavior (direct trajectory towards base or loiter)
        const dx = targetBase[0] - drone.position[0];
        const dy = targetBase[1] - drone.position[1];
        const dz = targetBase[2] - drone.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (drone.type === 'COMMERCIAL_QUAD') {
          // Commercial quadcopter loiters at 350m range recording surveillance
          if (dist > 350) {
            drone.velocity[0] = (dx / dist) * 14;
            drone.velocity[2] = (dz / dist) * 14;
          } else {
            // Circle reconnaissance pattern
            const perpX = -dz / dist;
            const perpZ = dx / dist;
            drone.velocity[0] = perpX * 8;
            drone.velocity[2] = perpZ * 8;
          }
          drone.velocity[1] = (65 - drone.position[1]) * 0.4;
        } else if (drone.type === 'CIVILIAN_SURVEILLANCE') {
          // Civilian drone moves in transit corridor, not attacking
          drone.velocity[0] = 12;
          drone.velocity[1] = (90 - drone.position[1]) * 0.2;
          drone.velocity[2] = -5;
        } else {
          // Hostile FPV Suicide or Loitering Munition:
          // Terminal dive acceleration when close
          let targetSpeed = 26;
          if (drone.type === 'FPV_SUICIDE') {
            targetSpeed = dist < 450 ? 55 : 36; // terminal dive acceleration!
          } else if (drone.type === 'LOITERING_MUNITION') {
            targetSpeed = 42;
          }

          drone.velocity[0] = (dx / dist) * targetSpeed;
          drone.velocity[1] = (dy / dist) * targetSpeed;
          drone.velocity[2] = (dz / dist) * targetSpeed;
        }
      }

      // Update position
      drone.position[0] += drone.velocity[0] * deltaSec;
      drone.position[1] = Math.max(1, drone.position[1] + drone.velocity[1] * deltaSec);
      drone.position[2] += drone.velocity[2] * deltaSec;

      this.updateDerivedTelemetry(drone);
    }

    return updated;
  }

  private computeFlockingAcceleration(
    boid: Drone,
    flock: Drone[],
    targetBase: [number, number, number]
  ): [number, number, number] {
    let sepX = 0, sepY = 0, sepZ = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliZ = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;

    for (const other of flock) {
      if (other.id === boid.id) continue;

      const dx = boid.position[0] - other.position[0];
      const dy = boid.position[1] - other.position[1];
      const dz = boid.position[2] - other.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Separation
      if (dist > 0 && dist < this.params.separationDistance) {
        sepX += dx / dist;
        sepY += dy / dist;
        sepZ += dz / dist;
        sepCount++;
      }

      // Alignment & Cohesion
      if (dist > 0 && dist < this.params.neighborDistance) {
        aliX += other.velocity[0];
        aliY += other.velocity[1];
        aliZ += other.velocity[2];
        aliCount++;

        cohX += other.position[0];
        cohY += other.position[1];
        cohZ += other.position[2];
        cohCount++;
      }
    }

    if (sepCount > 0) {
      sepX /= sepCount;
      sepY /= sepCount;
      sepZ /= sepCount;
    }
    if (aliCount > 0) {
      aliX /= aliCount;
      aliY /= aliCount;
      aliZ /= aliCount;
    }
    if (cohCount > 0) {
      cohX = (cohX / cohCount) - boid.position[0];
      cohY = (cohY / cohCount) - boid.position[1];
      cohZ = (cohZ / cohCount) - boid.position[2];
    }

    // Goal seeking toward base
    const toBaseX = targetBase[0] - boid.position[0];
    const toBaseY = targetBase[1] - boid.position[1];
    const toBaseZ = targetBase[2] - boid.position[2];
    const baseDist = Math.sqrt(toBaseX * toBaseX + toBaseY * toBaseY + toBaseZ * toBaseZ);

    const goalX = (toBaseX / baseDist) * 25;
    const goalY = (toBaseY / baseDist) * 25;
    const goalZ = (toBaseZ / baseDist) * 25;

    // Terminal dive boost if within 500m
    const terminalFactor = baseDist < 500 ? 2.2 : 1.0;

    const ax = (sepX * this.params.separationWeight + aliX * this.params.alignmentWeight + cohX * this.params.cohesionWeight + goalX * this.params.goalWeight) * terminalFactor;
    const ay = (sepY * this.params.separationWeight + aliY * this.params.alignmentWeight + cohY * this.params.cohesionWeight + goalY * this.params.goalWeight) * terminalFactor;
    const az = (sepZ * this.params.separationWeight + aliZ * this.params.alignmentWeight + cohZ * this.params.cohesionWeight + goalZ * this.params.goalWeight) * terminalFactor;

    return [ax, ay, az];
  }

  private updateDerivedTelemetry(drone: Drone) {
    const x = drone.position[0];
    const y = drone.position[1];
    const z = drone.position[2];

    drone.altitude = Math.round(y);
    const groundDist = Math.sqrt(x * x + z * z);
    drone.range = Math.round(Math.sqrt(x * x + y * y + z * z));

    // Azimuth: angle in degrees from North (z positive or negative)
    // 0 deg = North (Z-), 90 deg = East (X+), 180 deg = South (Z+), 270 deg = West (X-)
    let az = Math.atan2(x, -z) * (180 / Math.PI);
    if (az < 0) az += 360;
    drone.azimuth = Math.round(az);

    // Elevation angle
    const el = Math.atan2(y, groundDist) * (180 / Math.PI);
    drone.elevation = Math.round(el);

    // Speed
    const spd = Math.sqrt(drone.velocity[0] ** 2 + drone.velocity[1] ** 2 + drone.velocity[2] ** 2);
    drone.speed = Math.round(spd);

    // Heading of drone motion
    let hd = Math.atan2(drone.velocity[0], -drone.velocity[2]) * (180 / Math.PI);
    if (hd < 0) hd += 360;
    drone.heading = Math.round(hd);

    // Estimated Time to Impact (TTI)
    if (drone.speed > 1) {
      drone.timeToImpact = Math.max(0, Math.round(drone.range / drone.speed));
    } else {
      drone.timeToImpact = 999;
    }
  }
}

export const boidsEngine = new SwarmBoidsEngine();
