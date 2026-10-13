export default function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-slate-600" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      <span>{label}</span>
    </div>
  );
}
