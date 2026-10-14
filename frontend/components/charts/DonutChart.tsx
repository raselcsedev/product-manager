export interface DonutSlice {
  label: string;
  value: number;
  color: string; // any CSS color, e.g. "#10b981"
}

interface DonutChartProps {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
}

// A donut chart drawn with plain SVG circles (no chart library).
//
// How it works: a circle's outline has a known length (its circumference).
// "stroke-dasharray" draws only part of that outline, so each slice is one circle
// that draws just its share, and "stroke-dashoffset" moves it to where the previous slice ended.
export default function DonutChart({ slices, centerValue, centerLabel }: DonutChartProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  // Work out where every slice starts
  let used = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const length = (s.value / total) * circumference;
      const arc = { ...s, length, offset: used };
      used += length;
      return arc;
    });

  const description = slices.map((s) => `${s.label}: ${s.value}`).join(", ");

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center lg:flex-col xl:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={description}>
          {/* gray track behind the slices */}
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth="14"
              strokeDasharray={`${a.length} ${circumference - a.length}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{centerValue}</span>
          <span className="text-xs text-slate-500">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-2 text-sm">
        {slices.map((s) => {
          const percent = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                {s.label}
              </span>
              <span className="text-slate-600">
                {s.value} <span className="text-slate-400">({percent}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
