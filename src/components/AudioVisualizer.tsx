import React from 'react';
import { motion } from 'motion/react';

interface AudioVisualizerProps {
  volume: number;
  isActive: boolean;
  color?: string;
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  volume,
  isActive,
  color = '#2563eb',
  barCount = 16,
}) => {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-1.5 h-12 px-4" aria-label="Audio Visualizer">
      {bars.map((idx) => {
        // Create organic frequency curve centered in the middle
        const distFromCenter = Math.abs(idx - barCount / 2) / (barCount / 2);
        const factor = Math.max(0.2, 1 - distFromCenter * 0.7);
        const dynamicHeight = isActive
          ? Math.max(6, Math.min(44, (volume * 50 + 8) * factor * (0.6 + (idx % 3) * 0.25)))
          : 6;

        return (
          <motion.div
            key={idx}
            className="w-1.5 rounded-full"
            style={{
              backgroundColor: color,
              opacity: isActive ? 0.9 : 0.25,
            }}
            animate={{
              height: dynamicHeight,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
            }}
          />
        );
      })}
    </div>
  );
};
