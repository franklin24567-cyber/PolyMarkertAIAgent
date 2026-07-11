import clsx from "clsx";

const STATUS_STYLES: Record<string, string> = {
  track: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  watch: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ignore: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  paper_copy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  watchlist: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  skip: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  open: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  closed: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  resolved: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function DemoDataBadge({ isDemoData }: { isDemoData: boolean }) {
  if (!isDemoData) return null;
  return (
    <span className="inline-block rounded-full border border-fuchsia-500/30 bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-300">
      DEMO DATA
    </span>
  );
}
