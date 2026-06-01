"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Receipt } from "lucide-react";

interface StudentSummary {
  totalStudents: number;
  topBundles: Array<{ id: number; name: string; orderCount: number }>;
}

export default function AdminStudentsPage() {
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/revenue?days=365")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSummary({
            totalStudents: d.data.totalStudents,
            topBundles: d.data.topBundles,
          });
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader title="Students" subtitle="User base overview" />

      {loading || !summary ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-card shadow-soft p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">Total students</h2>
            </div>
            <p className="text-4xl font-bold mt-3">{summary.totalStudents}</p>
            <p className="text-sm text-muted-foreground mt-1">Active accounts</p>
          </div>

          <div className="rounded-2xl border bg-card shadow-soft p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Most popular bundles
            </h2>
            {summary.topBundles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bundle purchases yet</p>
            ) : (
              <div className="space-y-2">
                {summary.topBundles.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <p className="truncate">{b.name}</p>
                    <Badge variant="secondary">{b.orderCount}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 rounded-xl border bg-card p-6">
            <h2 className="font-semibold mb-2">Detailed student management</h2>
            <p className="text-sm text-muted-foreground mb-4">
              For MVP, the order log shows individual student activity and purchases. Per-student profile management (view attempts, grant manual access, ban) can be added in v2.
            </p>
            <Button asChild variant="outline">
              <Link href="/admin/orders">
                <Receipt className="h-4 w-4" />
                View order log
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
