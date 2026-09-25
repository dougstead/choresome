import { formatRelativeTime } from "@/lib/format";
import { getHouseholdStats } from "@/lib/services/stats-service";

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 text-center">
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
    </div>
  );
}

export default async function StatsPage() {
  const stats = await getHouseholdStats();
  const maxPerson = Math.max(1, ...stats.completionsByPerson.map((p) => p.count));
  const maxArea = Math.max(1, ...stats.completionsByArea.map((a) => a.count));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Household Stats</h1>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Completed this week" value={stats.completedThisWeek} />
        <Tile label="Completed this month" value={stats.completedThisMonth} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">By person (this month)</h2>
        {stats.completionsByPerson.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing completed yet this month.</p>
        ) : (
          <div className="space-y-2">
            {stats.completionsByPerson
              .sort((a, b) => b.count - a.count)
              .map((p) => (
                <div key={p.memberId} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-sm font-bold">{p.memberName}</span>
                  <div className="h-3 flex-1 rounded-full bg-surface-alt">
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${(p.count / maxPerson) * 100}%`, backgroundColor: "var(--color-primary)" }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm font-semibold text-text-muted">{p.count}</span>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">By area (this month)</h2>
        {stats.completionsByArea.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing completed yet this month.</p>
        ) : (
          <div className="space-y-2">
            {stats.completionsByArea
              .sort((a, b) => b.count - a.count)
              .map((a) => (
                <div key={a.areaId} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-sm font-bold">{a.areaName}</span>
                  <div className="h-3 flex-1 rounded-full bg-surface-alt">
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${(a.count / maxArea) * 100}%`, backgroundColor: "var(--color-today)" }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm font-semibold text-text-muted">{a.count}</span>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-text-muted">Recent activity</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing completed yet.</p>
        ) : (
          <ul className="space-y-2">
            {stats.recentActivity.map((event) => (
              <li key={event.id} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5">
                <span className="text-xl">{event.task.icon}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-bold">{event.task.name}</span>
                  <span className="text-text-muted"> — {event.member.name} — {formatRelativeTime(event.completedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
