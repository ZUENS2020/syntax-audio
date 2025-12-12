import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  className?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ audioRef, isPlaying, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const requestRef = useRef<number | null>(null);

  // Bright, neon syntax highlighting palette (Gradient Left to Right)
  const colors = [
      '#f92672', // pink
      '#fd971f', // orange
      '#e6db74', // yellow
      '#a6e22e', // green
      '#66d9ef', // blue
      '#ae81ff', // purple
  ];

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && !audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      // FFT size 256 gives 128 bins. 
      analyser.fftSize = 256; 
      analyser.smoothingTimeConstant = 0.7; // Smoother movement
      analyserRef.current = analyser;

      try {
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
      } catch (e) {
        // Source already connected
      }
    }

    if (isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const animate = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const analyser = analyserRef.current;
      
      if (!canvas || !analyser || !container) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Resize handling
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Font settings - monospaced and bold for visibility
      const fontSize = 16;
      ctx.font = `bold ${fontSize}px "Fira Code", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const charWidth = ctx.measureText('X').width;
      
      // Calculate capacity
      const maxCols = Math.floor(canvas.width / charWidth);
      
      // We will render a subset of frequency bins mapped to columns
      // Visualizer logic: distinct particles on a grid
      
      // Limit to lower frequencies where most music energy is (bins 0 to ~80 out of 128)
      const usefulFreqs = Math.floor(bufferLength * 0.7); 
      
      // Step to sample frequency array
      const step = Math.max(1, Math.floor(usefulFreqs / maxCols));

      for (let i = 0; i < maxCols; i++) {
        // Map column to frequency index
        const freqIndex = Math.floor(i * step);
        if (freqIndex >= bufferLength) break;

        const value = dataArray[freqIndex]; // 0-255
        
        // Threshold to draw anything
        if (value < 10) continue;

        const percent = value / 255; // 0.0 - 1.0

        // Calculate Y grid position
        // Baseline is somewhat low (80% down), moves up to 10% down
        const gridHeight = Math.floor(canvas.height / fontSize);
        const baselineRow = Math.floor(gridHeight * 0.8);
        const lift = Math.floor(percent * (gridHeight * 0.6));
        
        let row = baselineRow - lift;
        
        // Clamp row
        if (row < 0) row = 0;
        if (row >= gridHeight) row = gridHeight - 1;

        // Coordinates
        const x = i * charWidth + (charWidth / 2);
        const y = row * fontSize + (fontSize / 2);

        // Color Selection: Gradient across screen width
        const colorIndex = Math.floor((i / maxCols) * colors.length);
        const baseColor = colors[colorIndex % colors.length];
        
        // Character Selection:
        // "Regular symbols on upper layer"
        // High intensity (Upper layer) -> Regular dashes/lines
        // Mid intensity -> Active symbols
        // Low intensity -> Dots
        let char;
        if (percent > 0.85) char = i % 2 === 0 ? '-' : '_';
        else if (percent > 0.6) char = i % 2 === 0 ? '^' : '*';
        else if (percent > 0.4) char = i % 2 === 0 ? '+' : 'o';
        else char = i % 3 === 0 ? '.' : ':';

        // Draw "Cloud/Shadow" Effect FIRST (Background layer)
        // If intensity is high, add scattered particles
        if (percent > 0.65) {
             const offsetRow = (i % 2 === 0) ? -1 : 1;
             const y2 = (row + offsetRow) * fontSize + (fontSize / 2);
             
             // Use next color for variety, slightly transparent if possible? 
             // Canvas doesn't support easy alpha without parsing hex, so just use color.
             ctx.fillStyle = colors[(colorIndex + 1) % colors.length];
             ctx.globalAlpha = 0.6; // Make background layer fainter
             
             // Random scattering for cloud
             const char2 = percent > 0.85 ? '~' : '`';
             ctx.fillText(char2, x, y2);
             
             ctx.globalAlpha = 1.0; // Reset
        }

        // Draw Main Character LAST (Upper layer)
        ctx.fillStyle = baseColor;
        ctx.fillText(char, x, y);
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
        animate();
    } else {
        // Static "Waiting" State
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (canvas && container) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = 'bold 14px "Fira Code", monospace';
                ctx.fillStyle = '#75715e';
                ctx.textAlign = 'left';
                // Typewriter prompt
                ctx.fillText('> audio_link_established: false', 10, canvas.height/2);
                ctx.fillText('> waiting_for_signal...', 10, canvas.height/2 + 20);
            }
        }
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [audioRef, isPlaying]);

  return (
    <div ref={containerRef} className={`w-full h-32 relative ${className}`}>
        <canvas 
        ref={canvasRef} 
        className="block w-full h-full"
        />
    </div>
  );
};

export default Visualizer;