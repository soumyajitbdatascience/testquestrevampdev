"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  IndianRupee,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Loader2,
  ChevronRight,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AchievementPulseRings } from "@/components/decor/achievement-pulse-rings";

interface RevenueData {
  allTime: { revenue: number; orders: number };
  period: { days: number; revenue: number; orders: number };
  ordersByStatus: { status: string; count: number }[];
  dailyRevenue: { date: string; revenue: number; orders: number }[];
  topBundles: { id: number; name: string; price: number; orderCount: number }[];
  couponStats: { code: string; discountType: string; discountValue: number; timesUsed: number }[];
  totalStudents: number;
}

interface RecentOrder {
  id: number;
  itemType: string;
  amount: string | number;
  finalAmount: string | number;
  status: string;
  createdAt: string;
  student: { id: number; name: string; email: string };
  test: { id: number; name: string } | null;
  bundle: { id: number; name: string } | null;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/revenue?days=${days}`).then((r) => r.json()),
      fetch("/api/admin/orders?limit=5").then((r) => r.json()),
    ]).then(([rev, ord]) => {
      if (rev.ok) setData(rev.data);
      if (ord.ok) setOrders(ord.data.orders);
      setLoading(false);
    });
  }, [days]);

  if (loading || !data) {
    return (
      <div className="p-8 flex justify-center pt-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Dashboard"
        subtitle="An at-a-glance view of your platform."
        action={
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-44 h-10">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </Select>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          icon={<IndianRupee className="h-4 w-4" />}
          label={`Revenue · ${data.period.days}d`}
          value={`₹${data.period.revenue.toLocaleString("en-IN")}`}
          sub={`All-time ₹${data.allTime.revenue.toLocaleString("en-IN")}`}
          highlight
        />
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label={`Orders · ${data.period.days}d`}
          value={data.period.orders}
          sub={`All-time ${data.allTime.orders}`}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Students"
          value={data.totalStudents}
          sub="Active accounts"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg order"
          value={data.period.orders > 0 ? `₹${Math.round(data.period.revenue / data.period.orders)}` : "—"}
          sub={`Over ${data.period.days} days`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-surface shadow-soft p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl tracking-tight">Revenue trend</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Daily revenue over the last {data.period.days} days</p>
            </div>
          </div>

          {data.dailyRevenue.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
              No data for this period
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyRevenue}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0 0 0 / 0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "oklch(0.5 0 0)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-background)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => name === "revenue" ? [`₹${value}`, "Revenue"] : [value, "Orders"]}
                    labelFormatter={(label) => new Date(label).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-surface shadow-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-2xl tracking-tight">Top bundles</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Best sellers</p>
            </div>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>

          {data.topBundles.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No bundles sold yet
            </div>
          ) : (
            <div className="space-y-3">
              {data.topBundles.slice(0, 5).map((b, i) => (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-dim text-primary text-xs font-mono">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground">₹{b.price}</p>
                  </div>
                  <span className="text-sm font-medium">{b.orderCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 rounded-2xl border bg-surface shadow-soft overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="font-display text-2xl tracking-tight flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Recent orders
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Latest transactions</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/orders">
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {orders.length === 0 ? (
            <div className="p-16 text-center">
              <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-display text-xl tracking-tight">No orders yet</p>
              <p className="text-sm text-muted-foreground mt-1">Orders will appear once students start purchasing</p>
            </div>
          ) : (
            <div className="divide-y">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center gap-4 p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-dim text-primary font-medium text-sm">
                    {o.student.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{o.test?.name || o.bundle?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {o.student.name} · {o.student.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg tracking-tight">₹{o.finalAmount}</p>
                    <span className={cn(
                      "text-[10px] font-medium",
                      o.status === "PAID" ? "text-emerald-600" :
                      o.status === "FAILED" ? "text-red-600" :
                      "text-muted-foreground"
                    )}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border shadow-soft p-5 relative overflow-hidden",
      highlight ? "bg-primary text-primary-foreground shadow-gold border-transparent" : "bg-surface"
    )}>
      {highlight && (
        <AchievementPulseRings
          color="var(--primary-foreground)"
          anchor="bottom-right"
          ringCount={2}
          duration={3.2}
          size={40}
        />
      )}
      <div className="relative flex items-center justify-between">
        <span className={cn("text-xs", highlight ? "text-background/70" : "text-muted-foreground")}>{label}</span>
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          highlight ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary-dim text-primary"
        )}>
          {icon}
        </div>
      </div>
      <p className="mt-4 font-display text-3xl tracking-tight">{value}</p>
      <p className={cn("mt-1 text-xs flex items-center gap-1", highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>
        <ArrowUpRight className="h-3 w-3" />
        {sub}
      </p>
    </div>
  );
}
