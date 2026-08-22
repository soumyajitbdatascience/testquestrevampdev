"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Loader2, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestRow {
  id: number;
  name: string;
  durationMinutes: number;
  totalMarks: number;
  isFree: boolean;
  price: string | number;
  isPractice: boolean;
  isActive: boolean;
  class: { id: number; name: string };
  subject: { id: number; name: string };
  _count: { questions: number; attempts: number };
}

interface QuestionLite {
  id: number;
  text: string;
  type: string;
  marks: number;
}

interface ClassNode { id: number; name: string; subjects: { id: number; name: string }[] }

export default function AdminTestsPage() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [classes, setClasses] = useState<ClassNode[]>([]);
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TestRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState({
    name: "",
    description: "",
    classId: "",
    subjectId: "",
    durationMinutes: 30,
    isFree: false,
    price: 0,
    isPractice: false,
    randomizeQuestions: true,
    randomizeOptions: true,
    retakeCooldownDays: 0,
  });

  // Question picker
  const [availableQuestions, setAvailableQuestions] = useState<QuestionLite[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterClassId) params.set("classId", filterClassId);
    if (filterSubjectId) params.set("subjectId", filterSubjectId);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/tests?${params}`);
    const data = await res.json();
    if (data.ok) setTests(data.data.tests);
    setLoading(false);
  }, [filterClassId, filterSubjectId, search]);

  useEffect(() => {
    fetch("/api/taxonomy").then((r) => r.json()).then((d) => d.ok && setClasses(d.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const formClass = classes.find((c) => c.id === Number(form.classId));
  const filterClass = classes.find((c) => c.id === Number(filterClassId));

  async function loadAvailableQuestions() {
    if (!form.subjectId) return;
    setLoadingQuestions(true);
    const params = new URLSearchParams({ subjectId: form.subjectId, limit: "200" });
    if (pickerSearch) params.set("search", pickerSearch);
    const res = await fetch(`/api/admin/questions?${params}`);
    const data = await res.json();
    if (data.ok) setAvailableQuestions(data.data.questions);
    setLoadingQuestions(false);
  }

  useEffect(() => {
    if (dialogOpen && form.subjectId) loadAvailableQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, form.subjectId, pickerSearch]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      classId: "",
      subjectId: "",
      durationMinutes: 30,
      isFree: false,
      price: 0,
      isPractice: false,
      randomizeQuestions: true,
      randomizeOptions: true,
      retakeCooldownDays: 0,
    });
    setSelectedQuestionIds([]);
    setAvailableQuestions([]);
    setDialogOpen(true);
  }

  async function openEdit(t: TestRow) {
    setEditing(t);
    setForm({
      name: t.name,
      description: "",
      classId: String(t.class.id),
      subjectId: String(t.subject.id),
      durationMinutes: t.durationMinutes,
      isFree: t.isFree,
      price: Number(t.price),
      isPractice: t.isPractice,
      randomizeQuestions: true,
      randomizeOptions: true,
      retakeCooldownDays: 0,
    });

    // Load full test detail + current questions
    const detailRes = await fetch(`/api/admin/tests/${t.id}`);
    const detail = await detailRes.json();
    if (detail.ok) {
      setForm((f) => ({
        ...f,
        description: detail.data.description || "",
        randomizeQuestions: detail.data.randomizeQuestions,
        randomizeOptions: detail.data.randomizeOptions,
        retakeCooldownDays: detail.data.retakeCooldownDays,
      }));
      setSelectedQuestionIds(detail.data.questions.map((tq: { questionId: number }) => tq.questionId));
    }

    setDialogOpen(true);
  }

  async function save() {
    if (selectedQuestionIds.length === 0) {
      alert("Add at least one question");
      return;
    }
    setSaving(true);

    if (editing) {
      // Update test settings
      await fetch(`/api/admin/tests/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          classId: Number(form.classId),
          subjectId: Number(form.subjectId),
          durationMinutes: form.durationMinutes,
          isFree: form.isFree,
          price: form.price,
          isPractice: form.isPractice,
          randomizeQuestions: form.randomizeQuestions,
          randomizeOptions: form.randomizeOptions,
          retakeCooldownDays: form.retakeCooldownDays,
        }),
      });

      // Update questions
      await fetch(`/api/admin/tests/${editing.id}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: selectedQuestionIds }),
      });
    } else {
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          classId: Number(form.classId),
          subjectId: Number(form.subjectId),
          durationMinutes: form.durationMinutes,
          isFree: form.isFree,
          price: form.price,
          isPractice: form.isPractice,
          randomizeQuestions: form.randomizeQuestions,
          randomizeOptions: form.randomizeOptions,
          retakeCooldownDays: form.retakeCooldownDays,
          questionIds: selectedQuestionIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "Something went wrong");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setDialogOpen(false);
    load();
  }

  async function remove(t: TestRow) {
    if (!confirm(`Delete "${t.name}"?`)) return;
    await fetch(`/api/admin/tests/${t.id}`, { method: "DELETE" });
    load();
  }

  function toggleQuestion(id: number) {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Tests"
        subtitle="Assemble questions into tests for students"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New test
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card shadow-soft p-4 sm:p-5 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search tests" className="pl-10" />
          </div>
          <Button type="submit">Search</Button>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <Select value={filterClassId} onChange={(e) => { setFilterClassId(e.target.value); setFilterSubjectId(""); }}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={filterSubjectId} onChange={(e) => setFilterSubjectId(e.target.value)} disabled={!filterClass}>
            <option value="">All subjects</option>
            {filterClass?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </div>

      {/* TODO 5.2-F4: consider a card-list view on mobile instead of horizontal scroll. */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : tests.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No tests yet</div>
        ) : (
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Class / Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-xs">
                    <div>{t.class.name}</div>
                    <div className="text-muted-foreground">{t.subject.name}</div>
                  </TableCell>
                  <TableCell>{t.isPractice ? <Badge variant="warning">Practice</Badge> : <Badge variant="secondary">Timed</Badge>}</TableCell>
                  <TableCell>
                    {t.isFree ? <Badge variant="success">Free</Badge> : <span className="font-medium">₹{t.price}</span>}
                  </TableCell>
                  <TableCell>{t._count.questions}</TableCell>
                  <TableCell>{t._count.attempts}</TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "success" : "secondary"}>{t.isActive ? "Live" : "Hidden"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(t)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit test" : "Create test"}</DialogTitle>
            <DialogDescription>Set test details and pick questions</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Left: settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Test name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Real Numbers — Full Test" />
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: "" })}>
                    <option value="">Select</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={form.subjectId} onChange={(e) => { setForm({ ...form, subjectId: e.target.value }); setSelectedQuestionIds([]); }} disabled={!formClass}>
                    <option value="">Select</option>
                    {formClass?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" min="1" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Retake cooldown (days)</Label>
                  <Input type="number" min="0" value={form.retakeCooldownDays} onChange={(e) => setForm({ ...form, retakeCooldownDays: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked })} className="h-4 w-4" />
                  Free test (show without purchase)
                </Label>
                {!form.isFree && (
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} placeholder="Price in ₹" />
                )}
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isPractice} onChange={(e) => setForm({ ...form, isPractice: e.target.checked })} className="h-4 w-4" />
                  Practice mode (untimed, instant feedback)
                </Label>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.randomizeQuestions} onChange={(e) => setForm({ ...form, randomizeQuestions: e.target.checked })} className="h-4 w-4" />
                  Randomize question order per attempt
                </Label>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.randomizeOptions} onChange={(e) => setForm({ ...form, randomizeOptions: e.target.checked })} className="h-4 w-4" />
                  Randomize option order per attempt
                </Label>
              </div>
            </div>

            {/* Right: question picker */}
            <div className="space-y-2 border-l pl-4">
              <div className="flex items-center justify-between">
                <Label>Questions ({selectedQuestionIds.length} selected)</Label>
                <span className="text-xs text-muted-foreground">
                  Total marks: {availableQuestions.filter((q) => selectedQuestionIds.includes(q.id)).reduce((s, q) => s + q.marks, 0)}
                </span>
              </div>

              {form.subjectId ? (
                <>
                  <Input
                    placeholder="Search questions..."
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="text-sm"
                  />

                  <div className="border rounded-md max-h-96 overflow-y-auto divide-y">
                    {loadingQuestions ? (
                      <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : availableQuestions.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No questions found for this subject. Create some first.
                      </div>
                    ) : (
                      availableQuestions.map((q) => {
                        const selected = selectedQuestionIds.includes(q.id);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => toggleQuestion(q.id)}
                            className={cn(
                              "flex items-start gap-2 w-full text-left p-2 hover:bg-muted/50 transition-colors",
                              selected && "bg-primary/5"
                            )}
                          >
                            <div className={cn(
                              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border mt-0.5",
                              selected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                            )}>
                              {selected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm line-clamp-2">{q.text}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {q.type === "SINGLE_MCQ" ? "Single" : q.type === "MULTI_MCQ" ? "Multi" : "Fill"} · {q.marks}m
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                  Select a class and subject first
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name || !form.subjectId || selectedQuestionIds.length === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
