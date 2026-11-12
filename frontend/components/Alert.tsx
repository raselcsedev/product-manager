interface AlertProps {
  type: "success" | "error";
  message: string;
}

export default function Alert({ type, message }: AlertProps) {
  const isSuccess = type === "success";

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm font-medium transition-all ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {isSuccess ? (
          <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
      </span>
      <div className="flex-1 leading-relaxed">{message}</div>
    </div>
  );
}
