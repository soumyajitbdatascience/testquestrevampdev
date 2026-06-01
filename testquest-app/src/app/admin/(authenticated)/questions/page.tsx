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
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Upload,
  Download,
  Search,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type QType = "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";
type Difficulty = "EASY" | "MEDIUM" | "HARD";

interface OptionRow {
  id?: number;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionRow {
  id: number;
  type: QType;
  difficulty: Difficulty;
  text: string;
  explanation: string | null;
  correctText: string | null;
  marks: number;
  options: OptionRow[];
  chapter: { id: number; name: string; subject: { id: number; name: string; class: { id: number; name: string } } };
  _count: { testQuestions: number };
}

interface ClassNode { id: number; name: string; subjects: { id: number; name: string; chapters: { id: number; name: string }[] }[] }

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [classes, setClasses] = useState<ClassNode[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors?: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    classId: "",
    subjectId: "",
    type: "SINGLE_MCQ" as QType,
    difficulty: "MEDIUM" as Difficulty,
    text: "",
    explanation: "",
    correctText: "",
    marks: 1,
    options: [
      { label: "A", text: "", isCorrect: false },
      { label: "B", text: "", isCorrect: false },
      { label: "C", text: "", isCorrect: false },
      { label: "D", text: "", isCorrect: false },
    ] as OptionRow[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterSubjectId) params.set("subjectId", filterSubjectId);
    if (filterType) params.set("type", filterType);
    if (filterDifficulty) params.set("difficulty", filterDifficulty);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/admin/questions?${params}`);
    const data = await res.json();
    if (data.ok) {
      setQuestions(data.data.questions);
      setTotalPages(data.data.totalPages);
    }
    setLoading(false);
  }, [filterSubjectId, filterType, filterDifficulty, search, page]);

  useEffect(() => {
    fetch("/api/taxonomy").then((r) => r.json()).then((d) => d.ok && setClasses(d.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const formClass = classes.find((c) => c.id === Number(form.classId));

  function openCreate() {
    setEditing(null);
    setForm({
      classId: "",
      subjectId: "",
      type: "SINGLE_MCQ",
      difficulty: "MEDIUM",
      text: "",
      explanation: "",
      correctText: "",
      marks: 1,
      options: [
        { label: "A", text: "", isCorrect: false },
        { label: "B", text: "", isCorrect: false },
        { label: "C", text: "", isCorrect: false },
        { label: "D", text: "", isCorrect: false },
      ],
    });
    setDialogOpen(true);
  }

  function openEdit(q: QuestionRow) {
    setEditing(q);
    setForm({
      classId: String(q.chapter.subject.class.id),
      subjectId: String(q.chapter.subject.id),
      type: q.type,
      difficulty: q.difficulty,
      text: q.text,
      explanation: q.explanation || "",
      correctText: q.correctText || "",
      marks: q.marks,
      options: q.options.length > 0
        ? q.options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect }))
        : [
            { label: "A", text: "", isCorrect: false },
            { label: "B", text: "", isCorrect: false },
            { label: "C", text: "", isCorrect: false },
            { label: "D", text: "", isCorrect: false },
          ],
    });
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    const isMCQ = form.type === "SINGLE_MCQ" || form.type === "MULTI_MCQ";
    const body: Record<string, unknown> = {
      subjectId: Number(form.subjectId),
      type: form.type,
      difficulty: form.difficulty,
      text: form.text,
      explanation: form.explanation || undefined,
      marks: form.marks,
    };

    if (isMCQ) {
      body.options = form.options.filter((o) => o.text.trim());
    } else {
      body.correctText = form.correctText;
    }

    const url = editing ? `/api/admin/questions/${editing.id}` : "/api/admin/questions";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setDialogOpen(false);
      load();
    } else {
      alert(data.error || "Save failed");
    }
  }

  async function remove(q: QuestionRow) {
    if (!confirm("Soft-delete this question? It will be hidden from new tests.")) return;
    const res = await fetch(`/api/admin/questions/${q.id}`, { method: "DELETE" });
    if ((await res.json()).ok) load();
  }

  function updateOption(idx: number, patch: Partial<OptionRow>) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
  }

  function toggleCorrect(idx: number) {
    if (form.type === "SINGLE_MCQ") {
      setForm((f) => ({
        ...f,
        options: f.options.map((o, i) => ({ ...o, isCorrect: i === idx })),
      }));
    } else {
      updateOption(idx, { isCorrect: !form.options[idx].isCorrect });
    }
  }

  async function downloadTemplate() {
    const res = await fetch("/api/admin/questions/template");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_import_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importExcel() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", importFile);
    const res = await fetch("/api/admin/questions/import", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    setImporting(false);
    if (data.ok) {
      setImportResult(data.data);
      load();
    } else {
      alert(data.error);
    }
  }

  function typeLabel(t: QType) {
    return t === "SINGLE_MCQ" ? "Single MCQ" : t === "MULTI_MCQ" ? "Multi MCQ" : "Fill blank";
  }

  return (
    <div className="p-6 lg:p-10">
      <AdminPageHeader
        title="Questions"
        subtitle="Manage your question bank"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import Excel
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New question
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border bg-card shadow-soft p-4 sm:p-5 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search question text" className="pl-10" />
          </div>
          <Button type="submit">Search</Button>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={filterSubjectId} onChange={(e) => { setFilterSubjectId(e.target.value); setPage(1); }}>
            <option value="">All subjects</option>
            {classes.flatMap((c) => c.subjects.map((s) => (
              <option key={s.id} value={s.id}>{c.name} · {s.name}</option>
            )))}
          </Select>
          <Select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            <option value="SINGLE_MCQ">Single MCQ</option>
            <option value="MULTI_MCQ">Multi MCQ</option>
            <option value="FILL_IN_BLANK">Fill in blank</option>
          </Select>
          <Select value={filterDifficulty} onChange={(e) => { setFilterDifficulty(e.target.value); setPage(1); }}>
            <option value="">All difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      {/* TODO 5.2-F4: consider a card-list view on mobile instead of horizontal scroll. */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : questions.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">No questions found</div>
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">Question</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Used in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">
                    <div className="line-clamp-2">{q.text}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{typeLabel(q.type)}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={q.difficulty === "EASY" ? "success" : q.difficulty === "HARD" ? "destructive" : "warning"}>
                      {q.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{q.chapter.subject.class.name}</p>
                    <p className="text-sm">{q.chapter.subject.name}</p>
                  </TableCell>
                  <TableCell>{q._count.testQuestions} tests</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(q)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(q)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit question" : "Create question"}</DialogTitle>
            <DialogDescription>Build a question with type-specific answers</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: "" })}>
                  <option value="">Select</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Subject</Label>
                <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} disabled={!formClass}>
                  <option value="">Select</option>
                  {formClass?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as QType })}>
                  <option value="SINGLE_MCQ">Single MCQ</option>
                  <option value="MULTI_MCQ">Multi MCQ</option>
                  <option value="FILL_IN_BLANK">Fill in blank</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input type="number" min="1" value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Question text</Label>
              <Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={3} />
            </div>

            {/* Type-specific answer inputs */}
            {(form.type === "SINGLE_MCQ" || form.type === "MULTI_MCQ") && (
              <div className="space-y-2">
                <Label>
                  Options ({form.type === "SINGLE_MCQ" ? "pick one correct" : "pick one or more correct"})
                </Label>
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(i)}
                      className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border text-sm font-medium",
                        opt.isCorrect
                          ? "border-green-600 bg-green-50 text-green-700"
                          : "border-input hover:bg-muted"
                      )}
                    >
                      {opt.isCorrect ? <Check className="h-4 w-4" /> : opt.label}
                    </button>
                    <Input value={opt.text} onChange={(e) => updateOption(i, { text: e.target.value })} placeholder={`Option ${opt.label}`} />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Click the letter to mark as correct</p>
              </div>
            )}

            {form.type === "FILL_IN_BLANK" && (
              <div className="space-y-2">
                <Label>Correct answer(s)</Label>
                <Input value={form.correctText} onChange={(e) => setForm({ ...form, correctText: e.target.value })} placeholder="e.g. 12, twelve (comma-separated for multiple accepted answers)" />
                <p className="text-xs text-muted-foreground">Case-insensitive. Comma-separate accepted variations.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Explanation (optional but recommended)</Label>
              <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} placeholder="Why is this the answer?" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.text || !form.subjectId}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportFile(null); setImportResult(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import questions</DialogTitle>
            <DialogDescription>Upload an Excel file (.xlsx). Max 500 questions.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <Download className="h-4 w-4" />
              Download template
            </Button>

            <div className="space-y-2">
              <Label htmlFor="file">Excel file</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>

            {importResult && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                <p className="font-medium text-green-800">
                  <Check className="inline h-4 w-4 mr-1" />
                  Imported {importResult.imported} questions
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-amber-700 mt-1">{importResult.skipped} rows skipped</p>
                )}
                {importResult.errors && importResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {importResult.errors.length} errors
                    </summary>
                    <ul className="mt-1 list-disc list-inside text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                      {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              <X className="h-4 w-4" />
              Close
            </Button>
            <Button onClick={importExcel} disabled={importing || !importFile}>
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
