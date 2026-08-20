"use client";

/**
 * B2C subscriptions (design 2g): stat tiles, filters + "Expiring soon"
 * preset, CSV export, and the passes table with warning-coloured expiry.
 */
import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface PassRow {
  id: number; student: { name: string; email: string };
  boardCode: string; className: string; durationMonths: number | null;
  purchasedAt: string; expiresAt: string; daysLeft: number;
  amount: number | null; active: boolean;
}
interface Payload {
  tiles: { activePasses: number; revenueThisMonth: number; expiring7Days: number };
  rows: PassRow[]; total: number; page: number; pageSize: number;
}
interface BoardOpt { id: number; name: string; isActive: boolean }

export default function SubscriptionsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [boards, setBoards] = useState<BoardOpt[]>([]);
  const [boardId, setBoardId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const query = useCallback(() => {
    const q = new URLSearchParams({ page: String(page) });
    if (boardId) q.set("boardId", boardId);
    if (status) q.set("status", status);
    return q.toString();
  }, [boardId, status, page]);

  useEffect(() => {
    fetch("/api/admin/boards").then((r) => r.json()).then((d) => d.ok && setBoards(d.data));
  }, []);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/b2c-subscriptions?${query()}`).then((r) => r.json()).then((d) => d.ok && setData(d.data)).finally(() => setLoading(false));
  }, [query]);

  const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Subscriptions"
        subtitle="Class passes — the B2C revenue engine"
        action={
          <Button variant="outline" asChild>
            <a href={`/api/admin/b2c-subscriptions?${query()}&format=csv`} download>
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </Button>
        }
      />

      {/* Tiles */}
      {data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-text-muted-2">Active passes</p>
            <p className="mt-1 font-display text-3xl font-bold text-ink">{data.tiles.activePasses}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-text-muted-2">Revenue this month</p>
            <p className="mt-1 font-display text-3xl font-bold text-ink">₹{data.tiles.revenueThisMonth.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-text-muted-2">Expiring in 7 days</p>
            <p className="mt-1 font-display text-3xl font-bold text-[color:var(--warning)]">{data.tiles.expiring7Days}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Select value={boardId} onChange={(e) => { setBoardId(e.target.value); setPage(1); }} className="h-9 w-auto">
          <option value="">All boards</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-auto">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="expiring">Expiring soon</option>
        </Select>
        <button
          onClick={() => { setStatus("expiring"); setPage(1); }}
          className={cn(
            "h-9 rounded-full px-3.5 text-sm font-semibold",
            status === "expiring" ? "bg-primary text-primary-foreground" : "bg-wash text-primary",
          )}
        >
          Expiring soon
        </button>
      </div>

      <div className="rounded-2xl border bg-card overflow-x-auto">
        {loading || !data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : data.rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No passes match these filters.</div>
        ) : (
          <>
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-text-muted-2">
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-2 py-2.5">Board · Class</th>
                  <th className="px-2 py-2.5">Duration</th>
                  <th className="px-2 py-2.5">Purchased</th>
                  <th className="px-2 py-2.5">Expires</th>
                  <th className="px-2 py-2.5">Amount</th>
                  <th className="px-2 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink">{r.student.name}</p>
                      <p className="text-[11px] text-text-muted-2">{r.student.email}</p>
                    </td>
                    <td className="px-2 py-2.5">{r.boardCode} · {r.className}</td>
                    <td className="px-2 py-2.5">{r.durationMonths ? `${r.durationMonths} mo` : "—"}</td>
                    <td className="px-2 py-2.5">{fmt(r.purchasedAt)}</td>
                    <td className={cn("px-2 py-2.5", r.active && r.daysLeft <= 7 && "font-semibold text-[color:var(--warning)]")}>
                      {fmt(r.expiresAt)}{r.active && r.daysLeft <= 7 && <> · {r.daysLeft}d</>}
                    </td>
                    <td className="px-2 py-2.5">{r.amount != null ? `₹${r.amount}` : "—"}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant={r.active ? "success" : "secondary"}>{r.active ? "Active" : "Expired"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}</span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={data.page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
