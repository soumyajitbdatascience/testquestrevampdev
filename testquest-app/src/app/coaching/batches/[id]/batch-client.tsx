"use client";

/**
 * BatchClient — client-side tab UI for /coaching/batches/[id].
 *
 *  - Header with inline-editable batch name (owners/admins), chips, student
 *    count, sticky "Assign test" CTA
 *  - Tabs: Students | Assignments | Reports (Reports is a disabled placeholder)
 *  - Students tab uses StudentListItem rows with a soft-delete remove action
 *  - Assignments tab renders AssignmentCard list or EmptyState
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { Pencil, Check, X, ArrowRight, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StudentListItem, type StudentRow } from "@/components/coaching/student-list-item";
import { AssignmentCard } from "@/components/coaching/assignment-card";
import { EmptyState } from "@/components/coaching/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface TransferTarget {
  id: number;
  name: string;
  className: string | null;
}

export interface BatchAssignment {
  id: number;
  title: string | null;
  testId: number;
  dueAt: Date | string | null;
  createdAt: Date | string;
  isActive: boolean;
}

export interface BatchDetail {
  id: number;
  orgName: string;
  name: string;
  classId: number | null;
  className: string | null;
  board: string;
  subjects: string[];
  isActive: boolean;
  studentCount: number;
  students: StudentRow[];
  assignments: BatchAssignment[];
}

export function BatchClient({
  initial,
  canManage,
  canSendReport = false,
  canTransfer = false,
  transferTargets = [],
}: {
  initial: BatchDetail;
  canManage: boolean;
  canSendReport?: boolean;
  canTransfer?: boolean;
  transferTargets?: TransferTarget[];
}) {
  const router = useRouter();
  const [batch, setBatch] = useState(initial);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(batch.name);
  const [savingName, setSavingName] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Task 4.5: transfer dialog state.
  const [transferStudent, setTransferStudent] = useState<StudentRow | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<number | "">("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  // Task 3.3: per-student "Sent" pill keyed by studentId. Map value is the
  // timeout id so we can clear it if a row re-sends within the window.
  const [recentlySent, setRecentlySent] = useState<Record<number, number>>({});

  async function sendReport(studentId: number) {
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/coaching/batches/${batch.id}/students/${studentId}/send-report`,
        { method: "POST" },
      );
      const data = await res.json();
      if (data.ok) {
        setRecentlySent((prev) => {
          const next = { ...prev };
          if (next[studentId]) window.clearTimeout(next[studentId]);
          const timer = window.setTimeout(() => {
            setRecentlySent((p) => {
              const c = { ...p }; delete c[studentId]; return c;
            });
          }, 3000);
          next[studentId] = timer;
          return next;
        });
      } else {
        setErrorMsg(data.error || "Couldn't send the parent report. Try again.");
      }
    } catch {
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
    }
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (next.length < 1 || next === batch.name) {
      setEditingName(false);
      setNameDraft(batch.name);
      return;
    }
    setSavingName(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/coaching/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setBatch((b) => ({ ...b, name: next }));
        setEditingName(false);
      } else {
        setErrorMsg(data.error || "Couldn't rename batch. Try again.");
      }
    } catch {
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
    } finally { setSavingName(false); }
  }

  async function removeStudent(studentId: number) {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/coaching/batches/${batch.id}/students/${studentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok && data.data?.removed) {
        setBatch((b) => ({
          ...b,
          students: b.students.filter((s) => s.studentId !== studentId),
          studentCount: b.studentCount - 1,
        }));
        router.refresh();
      } else {
        setErrorMsg(data.error || "Couldn't remove student. Try again.");
      }
    } catch {
      setErrorMsg("Couldn't reach the server. Check your connection and try again.");
    }
  }

  function openTransfer(studentId: number) {
    const s = batch.students.find((x) => x.studentId === studentId);
    if (!s) return;
    setTransferStudent(s);
    setTransferTargetId("");
    setTransferError(null);
  }

  async function confirmTransfer() {
    if (!transferStudent || transferTargetId === "") return;
    setTransferring(true);
    setTransferError(null);
    try {
      const res = await fetch(
        `/api/coaching/batches/${batch.id}/students/${transferStudent.studentId}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toBatchId: transferTargetId }),
        },
      );
      const data = await res.json();
      if (data.ok && data.data?.transferred) {
        const removedId = transferStudent.studentId;
        setBatch((b) => ({
          ...b,
          students: b.students.filter((s) => s.studentId !== removedId),
          studentCount: b.studentCount - 1,
        }));
        setTransferStudent(null);
        router.refresh();
      } else {
        setTransferError(data.error || "Couldn't transfer student. Try again.");
      }
    } catch {
      setTransferError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setTransferring(false);
    }
  }

  const subjectsLine = batch.subjects.length > 0 ? batch.subjects : ["No subjects set"];

  return (
    <>
      {errorMsg && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-[12px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs text-destructive/70 hover:text-destructive shrink-0"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Batch</p>
          <div className="mt-1 flex items-center gap-2">
            {editingName ? (
              <>
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") { setEditingName(false); setNameDraft(batch.name); }
                  }}
                  disabled={savingName}
                  className="h-10 max-w-md bg-surface font-display text-2xl"
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={savingName}
                  className="rounded-md p-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  aria-label="Save name"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingName(false); setNameDraft(batch.name); }}
                  className="rounded-md p-2 border hover:bg-white/5"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl md:text-4xl text-foreground">{batch.name}</h1>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="rounded-md p-1.5 hover:bg-white/5 text-muted-foreground"
                    aria-label="Edit batch name"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {batch.className && <Badge variant="secondary" className="bg-surface-hi">{batch.className}</Badge>}
            <Badge variant="secondary" className="bg-surface-hi">{batch.board}</Badge>
            {subjectsLine.map((s) => (
              <Badge key={s} variant="secondary" className="bg-primary-dim text-primary">{s}</Badge>
            ))}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {batch.studentCount} {batch.studentCount === 1 ? "student" : "students"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {canManage && (
            <Link
              href={`/coaching/batches/${batch.id}/students/import`}
              className="inline-flex items-center gap-1.5 rounded-[10px] border bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-hi"
            >
              Import CSV
            </Link>
          )}
          <Link
            href={`/coaching/batches/${batch.id}/assign`}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
          >
            Assign test
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="students" className="mt-8">
        <TabsList className="overflow-x-auto justify-start max-w-full">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="reports" disabled title="Available in Phase 3">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6">
          {batch.students.length === 0 ? (
            <EmptyState
              title="No students yet."
              body="Invite students from the setup wizard, or share your batch invite link."
              ctaLabel="Open setup wizard"
              ctaHref="/coaching/setup"
            />
          ) : (
            <div className="rounded-[14px] border bg-surface divide-y">
              {batch.students.map((s) => (
                <StudentListItem
                  key={s.studentId}
                  {...s}
                  onRemove={removeStudent}
                  canManage={canManage}
                  onSendReport={canSendReport ? sendReport : undefined}
                  recentlySent={!!recentlySent[s.studentId]}
                  onTransfer={canTransfer ? openTransfer : undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="mt-6">
          {batch.assignments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Assign your first test."
              body="Pick a test from the Testquest bank, set a due date, and we'll notify your students."
              ctaLabel="Assign test"
              ctaHref={`/coaching/batches/${batch.id}/assign`}
            />
          ) : (
            <div className="space-y-3">
              {batch.assignments.map((a) => (
                <AssignmentCard
                  key={a.id}
                  id={a.id}
                  batchId={batch.id}
                  title={a.title}
                  dueAt={a.dueAt}
                  createdAt={a.createdAt}
                  isActive={a.isActive}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <div className="rounded-[14px] border bg-surface px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">Per-batch reports land in Phase 3.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Task 4.5 — Transfer student dialog */}
      <Dialog
        open={!!transferStudent}
        onOpenChange={(open) => {
          if (!open && !transferring) {
            setTransferStudent(null);
            setTransferError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer student</DialogTitle>
            <DialogDescription>
              {transferStudent
                ? `Move ${transferStudent.name} to another batch. Their attempt history stays linked.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {transferTargets.length === 0 ? (
            <div className="rounded-md border border-dashed bg-surface-hi px-4 py-6 text-center text-sm text-muted-foreground">
              You only have one batch — create another to transfer students.
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Transfer to
                </span>
                <select
                  className="mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm"
                  value={transferTargetId}
                  onChange={(e) =>
                    setTransferTargetId(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  disabled={transferring}
                >
                  <option value="">Choose a batch…</option>
                  {transferTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.className ? ` · ${t.className}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {transferError && (
                <p className="text-xs text-destructive">{transferError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (transferring) return;
                setTransferStudent(null);
                setTransferError(null);
              }}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmTransfer}
              disabled={
                transferring ||
                transferTargets.length === 0 ||
                transferTargetId === ""
              }
            >
              {transferring && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
