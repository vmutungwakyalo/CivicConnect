import type { computeStats } from "@/lib/requests";

/** Summary tiles: total, open (pending + in progress), resolved, resolution rate. */
export function StatCards({ stats }: { stats: ReturnType<typeof computeStats> }) {
  const tiles = [
    { label: "Total", value: stats.total },
    { label: "Open", value: stats.open, tone: "text-warning" },
    { label: "Resolved", value: stats.resolved, tone: "text-success" },
    { label: "Resolution rate", value: `${stats.resolutionRate}%` },
  ];
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">{t.label}</p>
          <p className={`font-display text-3xl font-bold ${t.tone ?? ""}`}>{t.value}</p>
        </div>
      ))}
    </div>
  );
}
