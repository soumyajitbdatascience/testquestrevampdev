"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Download, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportResult {
  parsed: number;
  enrolled: Array<{ studentId: number; name: string; created: boolean }>;
  skipped: Array<{ rowIndex: number; name?: string; reason: string }>;
}

interface Props {
  batchId: number;
}

export function ImportClient({ batchId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function pickFile(f: File | null) {
    setError(null);
    setResult(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      setError("Please choose a .csv file.");
      return;
    }
    setFile(f);
  }

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/coaching/batches/${batchId}/students/import`,
        { method: "POST", body: form },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Upload failed.");
      } else {
        setResult(json.data as ImportResult);
      }
    } catch (e) {
      setError((e as Error).message || "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setFile(null);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Template download */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-surface p-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Need the format?</p>
            <p className="text-xs text-muted-foreground">
              Columns: <code className="font-mono">name</code>,{" "}
              <code className="font-mono">mobile</code>,{" "}
              <code className="font-mono">email</code> (optional).
            </p>
          </div>
        </div>
        <a
          href="/api/coaching/batches/students/template"
          className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-semibold hover:bg-surface-hi"
        >
          <Download className="h-3.5 w-3.5" />
          Download template
        </a>
      </div>

      {/* Upload zone */}
      {!result && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0] ?? null;
            pickFile(f);
          }}
          className={`rounded-[14px] border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary-dim/40" : "border-border bg-surface"
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            {file ? file.name : "Drop your CSV here, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to 200 students per upload. .csv only.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={submitting}
            >
              Choose file
            </Button>
            {file && (
              <>
                <Button type="button" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Importing..." : "Import students"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => pickFile(null)}
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-[10px] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[14px] border bg-surface p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">
                Imported {result.enrolled.length} of {result.parsed} rows
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {result.enrolled.filter((e) => e.created).length} new students
                created,{" "}
                {result.enrolled.filter((e) => !e.created).length} already
                existed.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              Upload another
            </Button>
          </div>

          {result.skipped.length > 0 && (
            <div className="rounded-[14px] border bg-surface">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">
                  {result.skipped.length} skipped
                </p>
                <p className="text-xs text-muted-foreground">
                  Fix these and re-upload just the affected rows.
                </p>
              </div>
              <ul className="divide-y text-sm">
                {result.skipped.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.rowIndex > 0 ? `row ${s.rowIndex}` : "—"}
                      </span>{" "}
                      <span className="font-medium">{s.name ?? "(unnamed)"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground text-right">
                      {s.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
