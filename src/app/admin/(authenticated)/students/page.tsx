"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Loader2, Users, ChevronLeft, ChevronRight, Receipt, CheckCircle2 } from "lucide-react";

/**
 * Students — everyone who has signed up.
 *
 * Reads `tq_students`, which starts empty on this database: legacy students
 * were deliberately not migrated, so the list fills as people sign up.
 * Per-student detail (attempt history, manual grants) is a later pass.
 */
interface StudentRow {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  emailVerified: boolean;
  isActive: boolean;
  joinedAt: string;
  contexts: Array<{ boardId: number; classId: number; isPrimary: boolean; label: string }>;
  activePass: { label: string; expiresAt: string } | null;
  attempts: number;
  orders: number;
}
interface Option { id: number; name: string; code?: string }

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [boards, setBoards] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [boardId, setBoardId] = useState("");
  const [classId, setClassId] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const qs = new URLSearchParams({ page: String(page), limit: "25" });
    if (search.trim()) qs.set("search", search.trim());
    if (boardId) qs.set("boardId", boardId);
    if (classId) qs.set("classId", classId);
    try {
      const res = await fetch(`/api/admin/students?${qs}`, { signal });
      const d = await res.json();
      if (signal?.aborted) return;
      if (d.ok) {
        setStudents(d.data.students);
        setTotal(d.data.total);
        setTotalPages(d.data.totalPages);
      }
      setLoading(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setLoading(false);
    }
  }, [page, search, boardId, classId]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(controller.signal), search ? 300 : 0);
    return () => { clearTimeout(t); controller.abort(); };
  }, [load, search]);

  useEffect(() => {
    fetch("/api/admin/boards").then((r) => r.json()).then((d) => d.ok && setBoards(d.data));
    fetch("/api/admin/taxonomy/classes").then((r) => r.json()).then((d) => d.ok && setClasses(d.data));
  }, []);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Students"
        subtitle={loading ? "Loading…" : `${total.toLocaleString()} signed up`}
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/orders">
              <Receipt className="h-4 w-4" />
              Order log
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => changeFilter(() => setSearch(e.target.value))}
          placeholder="Search name, email or mobile"
          className="h-10 max-w-xs"
        />
        <Select
          value={boardId}
          onChange={(e) => changeFilter(() => setBoardId(e.target.value))}
          className="h-10 w-auto min-w-[10rem]"
        >
          <option value="">All boards</option>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select
          value={classId}
          onChange={(e) => changeFilter(() => setClassId(e.target.value))}
          className="h-10 w-auto min-w-[10rem]"
        >
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">
            {total === 0 && !search && !boardId && !classId ? "No students yet" : "No students match"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 && !search && !boardId && !classId
              ? "This database starts empty — legacy students were not migrated. The list fills as people sign up."
              : "Try clearing the search or filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-[13px]">
            <thead className="border-b bg-surface-hi/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="w-36 px-3 py-2 font-medium">Studying</th>
                <th className="w-40 px-3 py-2 font-medium">Active pass</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Attempts</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Orders</th>
                <th className="w-28 px-3 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-surface-hi/40">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{s.name}</span>
                      {s.emailVerified && (
                        <CheckCircle2 className="h-3 w-3 text-green-600" aria-label="Email verified" />
                      )}
                      {!s.isActive && <Badge variant="secondary" className="text-[10px]">disabled</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.email}{s.mobile ? ` · ${s.mobile}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {s.contexts.length === 0 ? (
                      <Badge variant="warning" className="text-[10px]">not set</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {s.contexts.map((c) => (
                          <Badge
                            key={`${c.boardId}-${c.classId}`}
                            variant={c.isPrimary ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {c.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.activePass ? (
                      <div>
                        <Badge variant="success" className="text-[10px]">{s.activePass.label}</Badge>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          until {new Date(s.activePass.expiresAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.attempts || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.orders || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(s.joinedAt).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {total.toLocaleString()} student{total === 1 ? "" : "s"} · page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
