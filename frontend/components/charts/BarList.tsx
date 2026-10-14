export interface BarItem {
  label: string;
  value: number;
  detail?: string; // small gray text under the bar
}

interface BarListProps {
  items: BarItem[];
  format: (value: number) => string;
}

// Horizontal bar chart made of plain divs: each bar's width is its share of the biggest value.
export default function BarList({ items, format }: BarListProps) {
  const max = Math.max(0, ...items.map((i) => i.value));

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        // Never let a real value shrink to an invisible bar
        const percent = item.value > 0 && max > 0 ? Math.max(2, (item.value / max) * 100) : 0;

        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 text-slate-700">{format(item.value)}</span>
            </div>
            <div className="mt-1 h-2.5 w-full rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
            </div>
            {item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}
          </li>
        );
      })}
    </ul>
  );
}
