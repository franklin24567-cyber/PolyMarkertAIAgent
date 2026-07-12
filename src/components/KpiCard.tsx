import clsx from "clsx";

export function KpiCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={clsx(
          "mt-2 text-2xl font-semibold",
          trend === "up" && "text-emerald-400",
          trend === "down" && "text-rose-400",
          (!trend || trend === "neutral") && "text-gray-100"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}
