import React from 'react';

const ProgressRing = React.memo(function ProgressRing({ size = 44, radius = 18, strokeWidth = 3, percent = 0, color = '#6366f1', fontSize = 11 }) {
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashArray = `${(percent / 100) * circumference} ${circumference}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth}
      />
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text
        x={center} y={center + fontSize * 0.35}
        textAnchor="middle" fill="#fff"
        fontSize={fontSize} fontWeight="600"
        fontFamily="DM Sans, sans-serif"
      >
        {percent}%
      </text>
    </svg>
  );
});

export default ProgressRing;
