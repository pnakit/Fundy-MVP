import React from 'react';

const RadarChart = React.memo(function RadarChart({ data, size = 300 }) {
  const center = size / 2;
  const radius = size * 0.38;
  const angleStep = (2 * Math.PI) / data.length;

  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const gridLevels = [20, 40, 60, 80, 100];

  const dataPoints = data.map((d, i) => getPoint(i, d.score));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} className="radar-chart" style={{ overflow: 'visible' }}>
      {/* Grid circles */}
      {gridLevels.map(level => (
        <polygon
          key={level}
          points={data.map((_, i) => {
            const p = getPoint(i, level);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {data.map((_, i) => {
        const p = getPoint(i, 100);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <path
        d={pathD}
        fill="rgba(99, 102, 241, 0.25)"
        stroke="#6366f1"
        strokeWidth="2"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="5"
          fill="#6366f1"
          stroke="#fff"
          strokeWidth="2"
        />
      ))}

      {/* Labels */}
      {data.map((d, i) => {
        const labelRadius = radius + 35;
        const angle = angleStep * i - Math.PI / 2;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize="12"
            fontWeight="500"
          >
            {d.name}
          </text>
        );
      })}
    </svg>
  );
});

export default RadarChart;
