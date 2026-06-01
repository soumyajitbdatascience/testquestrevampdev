"use client";

/**
 * LogoDropzone — drag-or-click logo upload with preview and inline validation.
 *
 * Accepts: image/png, image/jpeg, image/svg+xml. Max 2MB.
 * The actual upload (multipart POST) is handled by the parent; this component
 * just exposes the picked File via onFile + shows the preview/error state.
 *
 * If an existing URL is provided (e.g. resuming the wizard), it's shown until
 * the user picks a new file.
 */
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPT = ["image/png", "image/jpeg", "image/svg+xml"];

export interface LogoDropzoneProps {
  /** Existing URL to show as initial preview (from resume / re-edit). */
  existingUrl?: string | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
}

export function LogoDropzone({ existingUrl, onFile, disabled }: LogoDropzoneProps) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    // Revoke any object URL the component created.
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  function handle(file: File | null) {
    setError(null);
    if (!file) {
      onFile(null);
      setPreview(existingUrl ?? null);
      return;
    }
    if (!ACCEPT.includes(file.type)) {
      setError("Logo must be PNG, JPG, or SVG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Logo must be 2 MB or smaller.");
      return;
    }
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          handle(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "rounded-[14px] border-2 border-dashed bg-surface px-6 py-8 cursor-pointer transition-all",
          dragging ? "border-primary bg-primary-dim" : "border-border hover:border-primary/40",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          onChange={(e) => handle(e.target.files?.[0] ?? null)}
          className="hidden"
          disabled={disabled}
        />
        {preview ? (
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-md overflow-hidden bg-background ring-1 ring-border">
              {/* next/image needs known dims; for arbitrary uploads we use a plain img tag. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Logo preview" className="h-full w-full object-contain" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium">Logo selected</p>
              <p className="text-xs text-muted-foreground">Click to replace, or drag a new file.</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handle(null); }}
              className="rounded-md p-1.5 hover:bg-white/5"
              aria-label="Remove logo"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-dim text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div className="text-sm">
              <p className="font-medium">Drop your logo here</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or SVG — up to 2 MB</p>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
// next/image kept imported to remain consistent across the codebase even though we
// fall back to <img> for arbitrary uploaded blobs.
void Image;
