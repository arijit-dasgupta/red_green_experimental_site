import React from 'react';

/**
 * VisualCountdownRing
 * - Visual countdown ring with optional centered label (digit).
 * - progress: 1 → full ring, 0 → empty ring
 */
export default function VisualCountdownRing({
  progress = 1,
  size = 120,
  strokeWidth = 12,
  color = '#2ecc71',
  trackColor = 'rgba(0,0,0,0.10)',
  glow = true,
  label = null,
  labelColor,
  labelSize,
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - clamped);

  const resolvedLabelColor = labelColor || color;
  const resolvedLabelSize = labelSize || Math.round(size * 0.35);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-block' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          display: 'block',
          filter: glow ? `drop-shadow(0 0 10px ${color}55)` : undefined,
        }}
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dashoffset 0.9s linear',
          }}
        />
      </svg>
      {label != null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${resolvedLabelSize}px`,
            fontWeight: 'bold',
            color: resolvedLabelColor,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
