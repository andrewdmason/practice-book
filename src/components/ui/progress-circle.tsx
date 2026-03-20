"use client";

type ProgressCircleProps = {
  progress: number; // 0-4
  size?: number;
  className?: string;
};

export function ProgressCircle({
  progress,
  size = 16,
  className,
}: ProgressCircleProps) {
  const center = size / 2;
  const radius = (size - 2) / 2; // 1px inset for stroke

  if (progress === 0) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={className}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          opacity={0.3}
        />
      </svg>
    );
  }

  if (progress === 4) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={className}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="currentColor"
        />
        <polyline
          points={`${size * 0.28},${size * 0.52} ${size * 0.44},${size * 0.68} ${size * 0.72},${size * 0.35}`}
          fill="none"
          stroke="var(--background, white)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Progress 1-3: pie slices
  // Start at top (270 degrees / -90), each quarter = 90 degrees
  const slices = progress;
  const startAngle = -90;
  const endAngle = startAngle + slices * 90;

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = center + radius * Math.cos(startRad);
  const y1 = center + radius * Math.sin(startRad);
  const x2 = center + radius * Math.cos(endRad);
  const y2 = center + radius * Math.sin(endRad);

  const largeArc = slices > 2 ? 1 : 0;

  const pathData = [
    `M ${center} ${center}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
    "Z",
  ].join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.3}
      />
      <path d={pathData} fill="currentColor" opacity={0.7} />
    </svg>
  );
}
