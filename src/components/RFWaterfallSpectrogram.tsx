import React, { useRef, useEffect } from 'react';
import { Drone } from '../types/tactical';

interface RFWaterfallSpectrogramProps {
  drones: Drone[];
  selectedDroneId: string | null;
}

export const RFWaterfallSpectrogram: React.FC<RFWaterfallSpectrogramProps> = ({
  drones,
  selectedDroneId,
}) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null);

  // Frequency bins across spectrum (from 400 MHz to 6000 MHz / 6 GHz)
  // Channels: 433M, 868M, 915M, 1.2G, 1.57G (GPS), 2.4G, 5.8G
  const channels = [
    { freqMhz: 433, label: '433M', band: 'LoRa/C2' },
    { freqMhz: 868, label: '868M', band: 'ELRS' },
    { freqMhz: 915, label: '915M', band: 'TBS' },
    { freqMhz: 1575, label: '1.57G', band: 'GPS L1' },
    { freqMhz: 2400, label: '2.4G', band: 'ISM/C2' },
    { freqMhz: 5800, label: '5.8G', band: 'FPV VTX' },
  ];

  useEffect(() => {
    const specCanvas = spectrumCanvasRef.current;
    const waterCanvas = waterfallCanvasRef.current;
    if (!specCanvas || !waterCanvas) return;

    const sCtx = specCanvas.getContext('2d');
    const wCtx = waterCanvas.getContext('2d');
    if (!sCtx || !wCtx) return;

    let animId: number;

    const render = () => {
      animId = requestAnimationFrame(render);
      const width = specCanvas.width;
      const height = specCanvas.height;

      // 1. Draw Spectrum Amplitude (Line Plot)
      sCtx.fillStyle = '#060c0e';
      sCtx.fillRect(0, 0, width, height);

      // Noise floor (-95 dBm)
      sCtx.strokeStyle = '#0e2428';
      sCtx.lineWidth = 1;
      sCtx.beginPath();
      for (let y = 15; y < height; y += 20) {
        sCtx.moveTo(0, y);
        sCtx.lineTo(width, y);
      }
      sCtx.stroke();

      // Compute RF signal amplitude per X pixel
      const amplitudes: number[] = new Array(width).fill(0);
      for (let i = 0; i < width; i++) {
        // baseline thermal noise
        amplitudes[i] = 12 + Math.random() * 8;
      }

      // Add spikes for active drones
      drones.forEach((drone) => {
        if (drone.status === 'DESTROYED') return;

        let targetFreq = 2400;
        if (drone.rfFreq.includes('5.8')) targetFreq = 5800;
        else if (drone.rfFreq.includes('868')) targetFreq = 868;
        else if (drone.rfFreq.includes('915')) targetFreq = 915;
        else if (drone.rfFreq.includes('433')) targetFreq = 433;

        // Map frequency to X position
        // Freq range: 300MHz to 6000MHz
        const normX = ((targetFreq - 300) / (6000 - 300)) * width;
        const centerBin = Math.round(normX);
        const power = Math.max(25, 75 - (drone.range / 3000) * 45); // closer = higher amplitude

        for (let offset = -8; offset <= 8; offset++) {
          const bin = centerBin + offset;
          if (bin >= 0 && bin < width) {
            const bell = Math.exp(-(offset * offset) / 12);
            amplitudes[bin] = Math.max(amplitudes[bin], amplitudes[bin] + power * bell);
          }
        }
      });

      // Draw Spectrum trace
      sCtx.beginPath();
      sCtx.moveTo(0, height - amplitudes[0]);
      for (let i = 1; i < width; i++) {
        sCtx.lineTo(i, height - amplitudes[i]);
      }
      sCtx.strokeStyle = '#00ffaa';
      sCtx.lineWidth = 1.5;
      sCtx.stroke();

      // Gradient fill under spectrum
      sCtx.lineTo(width, height);
      sCtx.lineTo(0, height);
      const traceGrad = sCtx.createLinearGradient(0, 0, 0, height);
      traceGrad.addColorStop(0, 'rgba(0, 255, 170, 0.3)');
      traceGrad.addColorStop(1, 'rgba(0, 255, 170, 0.02)');
      sCtx.fillStyle = traceGrad;
      sCtx.fill();

      // Channel markers on spectrum
      channels.forEach((ch) => {
        const cx = ((ch.freqMhz - 300) / (6000 - 300)) * width;
        sCtx.strokeStyle = '#ffaa00';
        sCtx.setLineDash([2, 2]);
        sCtx.beginPath();
        sCtx.moveTo(cx, 0);
        sCtx.lineTo(cx, height);
        sCtx.stroke();
        sCtx.setLineDash([]);

        sCtx.font = '8px monospace';
        sCtx.fillStyle = '#ffaa00';
        sCtx.fillText(ch.label, cx - 10, 10);
      });

      // 2. Scroll Waterfall Downward
      // Shift existing waterfall image down by 1px
      wCtx.drawImage(waterCanvas, 0, 0, width, waterCanvas.height - 1, 0, 1, width, waterCanvas.height - 1);

      // Draw top 1px line using current amplitudes
      for (let i = 0; i < width; i++) {
        const val = Math.min(1, amplitudes[i] / 80);
        let color = '#050a0c';
        if (val > 0.8) color = '#ff3344'; // Red peak
        else if (val > 0.6) color = '#ffaa00'; // Orange
        else if (val > 0.4) color = '#00ffaa'; // Bright green
        else if (val > 0.25) color = '#0e4a3b'; // Cyan green
        else color = `rgba(10, 30, 35, ${val * 1.5})`;

        wCtx.fillStyle = color;
        wCtx.fillRect(i, 0, 1, 1);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [drones]);

  const selectedDrone = drones.find((d) => d.id === selectedDroneId);

  return (
    <div className="flex flex-col bg-[#070e10] border border-[#14282c] rounded p-2 shadow-lg select-none text-[11px] font-mono">
      {/* Header */}
      <div className="w-full flex items-center justify-between pb-1 border-b border-[#14282c]">
        <div className="flex items-center gap-1.5 text-[#ffaa00]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffaa00] animate-pulse" />
          <span className="font-bold">RF WATERFALL EW</span>
        </div>
        <span className="text-gray-400 text-[9px]">300MHz - 6.0GHz</span>
      </div>

      {/* Real-time Spectrum Trace */}
      <div className="relative mt-1">
        <canvas
          ref={spectrumCanvasRef}
          width={280}
          height={48}
          className="w-full h-11 border-b border-[#14282c]"
        />
        <div className="absolute top-0.5 left-1.5 text-[7.5px] text-[#00ffaa]">RF POWER (dBm)</div>
      </div>

      {/* Waterfall Heatmap */}
      <div className="relative">
        <canvas
          ref={waterfallCanvasRef}
          width={280}
          height={58}
          className="w-full h-14"
        />
        <div className="absolute bottom-0.5 right-1.5 text-[7.5px] text-gray-500">TIME ↓</div>
      </div>

      {/* Active Carrier Emitter Intercept Box */}
      <div className="mt-1 bg-[#091518] p-1.5 rounded border border-[#142e26] text-[10px]">
        {selectedDrone ? (
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-gray-400">EMITTER LINK:</span>
              <span className="text-[#00ffaa] font-bold">{selectedDrone.protocol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">DOWNLINK FREQ:</span>
              <span className="text-[#ffaa00] font-bold">{selectedDrone.rfFreq}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">RSSI:</span>
              <span className="text-[#00ffaa]">
                {Math.max(-95, Math.round(-35 - (selectedDrone.range / 100)))} dBm
              </span>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-0.5 italic text-[9px]">
            Designate target to isolate RF link
          </div>
        )}
      </div>
    </div>
  );
};
