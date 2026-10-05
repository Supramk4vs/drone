import React, { useRef, useEffect } from 'react';
import { Drone } from '../types/tactical';
import { tacticalAudio } from '../services/audioSynthesizer';

interface RadarPPIProps {
  drones: Drone[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
  maxRangeMeters?: number; // default 3000m
}

export const RadarPPI: React.FC<RadarPPIProps> = ({
  drones,
  selectedDroneId,
  onSelectDrone,
  maxRangeMeters = 3000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sweepAngleRef = useRef<number>(0);
  const prevPingedDroneIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      animId = requestAnimationFrame(render);

      // Increment sweep angle (rotating clockwise)
      sweepAngleRef.current = (sweepAngleRef.current + 0.025) % (Math.PI * 2);
      const sweepAngle = sweepAngleRef.current;

      const size = Math.min(canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = size * 0.44;

      // Clear with dark tactical radar background
      ctx.fillStyle = '#060e10';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw outer bezel
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#081416';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ffaa';
      ctx.stroke();

      // Range Rings (500m, 1000m, 2000m, 3000m)
      const rings = [
        { dist: 500, color: '#ff3344', label: '500m KILL ZONE' },
        { dist: 1000, color: '#ffaa00', label: '1000m WARN' },
        { dist: 2000, color: '#164e3c', label: '2000m' },
        { dist: 3000, color: '#164e3c', label: '3000m RADAR MAX' },
      ];

      rings.forEach((ring) => {
        const r = (ring.dist / maxRangeMeters) * radius;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.dist === 500 ? 1.5 : 1;
        ctx.setLineDash(ring.dist === 500 ? [4, 4] : [2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on ring
        ctx.font = '9px monospace';
        ctx.fillStyle = ring.color;
        ctx.fillText(ring.label, cx + 4, cy - r + 11);
      });

      // Azimuth Cardinal Crosshairs
      ctx.strokeStyle = '#1b3b32';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // Degree Tick Marks around circumference
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + Math.sin(rad) * (radius - 5);
        const y1 = cy - Math.cos(rad) * (radius - 5);
        const x2 = cx + Math.sin(rad) * radius;
        const y2 = cy - Math.cos(rad) * radius;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#00ffaa';
        ctx.stroke();

        if (deg % 90 === 0) {
          const label = deg === 0 ? '000° N' : deg === 90 ? '090° E' : deg === 180 ? '180° S' : '270° W';
          const lx = cx + Math.sin(rad) * (radius - 18);
          const ly = cy - Math.cos(rad) * (radius - 18);
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#00ffaa';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, lx, ly);
        }
      }

      // Draw Rotating Sweeping Beam (Phosphor Gradient)
      const grad = ctx.createConicGradient(sweepAngle, cx, cy);
      grad.addColorStop(0, 'rgba(0, 255, 170, 0.4)');
      grad.addColorStop(0.12, 'rgba(0, 255, 170, 0.05)');
      grad.addColorStop(0.2, 'rgba(0, 255, 170, 0)');
      grad.addColorStop(1, 'rgba(0, 255, 170, 0)');

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, sweepAngle, sweepAngle + Math.PI * 0.4);
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw Leading Sweep Line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw Protected Base Center Marker
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00ffaa';
      ctx.fill();
      ctx.font = '8px monospace';
      ctx.fillStyle = '#00ffaa';
      ctx.fillText('FOB BASE', cx + 7, cy + 3);

      // Draw Drone Targets
      const currentlyPinged = new Set<string>();

      drones.forEach((drone) => {
        if (drone.status === 'DESTROYED') return;

        // Position on radar:
        // World coordinates: x is East(+)/West(-), z is South(+)/North(-)
        const normDist = (drone.range / maxRangeMeters) * radius;
        const targetAngle = Math.atan2(drone.position[0], -drone.position[2]); // North is up (-z)

        const px = cx + Math.sin(targetAngle) * normDist;
        const py = cy - Math.cos(targetAngle) * normDist;

        // Check if sweeping beam just crossed drone angle
        // Angle from center
        let beamDiff = (sweepAngle - (targetAngle - Math.PI / 2) + Math.PI * 4) % (Math.PI * 2);
        if (beamDiff < 0.1) {
          currentlyPinged.add(drone.id);
          if (!prevPingedDroneIdsRef.current.has(drone.id)) {
            tacticalAudio.playRadarPing();
          }
        }

        const isSelected = drone.id === selectedDroneId;

        // Draw Selection Ring if locked
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, 11, 0, Math.PI * 2);
          ctx.strokeStyle = '#00ffaa';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw Target Blip Symbol
        ctx.save();
        ctx.translate(px, py);

        if (drone.status === 'JAMMED') {
          // Cyan flickering diamond
          ctx.rotate(Math.PI / 4);
          ctx.strokeStyle = '#00d5ff';
          ctx.fillStyle = 'rgba(0, 213, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-4, -4, 8, 8);
          ctx.fillRect(-4, -4, 8, 8);
        } else if (drone.status === 'SPOOFED') {
          // Yellow Diverted Circle
          ctx.strokeStyle = '#ffaa00';
          ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fill();
        } else if (drone.isHostile) {
          // Hostile: Red inverted triangle
          ctx.fillStyle = '#ff2233';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 5);
          ctx.lineTo(-5, -4);
          ctx.lineTo(5, -4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Neutral / Civilian: Green Square
          ctx.fillStyle = '#22cc88';
          ctx.fillRect(-4, -4, 8, 8);
        }

        // Draw Velocity Lead Vector
        if (drone.speed > 0) {
          const vx = (drone.velocity[0] / maxRangeMeters) * radius * 3.5;
          const vz = (-drone.velocity[2] / maxRangeMeters) * radius * 3.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(vx, vz);
          ctx.strokeStyle = drone.isHostile ? '#ff5566' : '#55ffaa';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        ctx.restore();

        // Label beside contact
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = isSelected ? '#00ffaa' : drone.isHostile ? '#ff6677' : '#55eeaa';
        ctx.fillText(`${drone.callsign}`, px + 8, py - 4);
        ctx.font = '8px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${drone.range}m | ${drone.altitude}m`, px + 8, py + 6);
      });

      prevPingedDroneIdsRef.current = currentlyPinged;
      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [drones, selectedDroneId, maxRangeMeters]);

  // Handle clicking on radar canvas to select target
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.44;

    let closestDrone: Drone | null = null;
    let minDist = 22; // click tolerance in px

    for (const drone of drones) {
      if (drone.status === 'DESTROYED') continue;
      const normDist = (drone.range / maxRangeMeters) * radius;
      const targetAngle = Math.atan2(drone.position[0], -drone.position[2]);
      const px = cx + Math.sin(targetAngle) * normDist;
      const py = cy - Math.cos(targetAngle) * normDist;

      const d = Math.hypot(clickX - px, clickY - py);
      if (d < minDist) {
        minDist = d;
        closestDrone = drone;
      }
    }

    if (closestDrone) {
      const target: Drone = closestDrone;
      onSelectDrone(target.id);
      tacticalAudio.playLockAcquired();
    }
  };

  return (
    <div className="relative flex flex-col items-center bg-[#070e10] border border-[#14282c] rounded p-2 shadow-lg select-none">
      {/* Header */}
      <div className="w-full flex items-center justify-between pb-1 border-b border-[#14282c] text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-[#00ffaa]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-ping" />
          <span className="font-bold">AN/TPQ-53 3D RADAR</span>
        </div>
        <span className="text-gray-400 text-[9px]">360° PPI | 3.0 KM</span>
      </div>

      {/* Radar PPI Canvas */}
      <div className="relative mt-1 cursor-pointer">
        <canvas
          ref={canvasRef}
          width={250}
          height={250}
          onClick={handleCanvasClick}
          className="rounded-full shadow-inner"
        />

        {/* Tactical Legend overlay */}
        <div className="absolute bottom-1 left-2 text-[8px] font-mono text-gray-400 flex flex-col gap-0.5 pointer-events-none bg-black/70 px-1 py-0.5 rounded border border-[#14282c]">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#ff2233] inline-block" /> Hostile
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#00d5ff] inline-block" /> Jammed
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#22cc88] inline-block" /> Civilian
          </div>
        </div>
      </div>
    </div>
  );
};
