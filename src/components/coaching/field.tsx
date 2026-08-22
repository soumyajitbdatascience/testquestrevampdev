"use client";

/**
 * Field — labeled text input with optional hint + error styling.
 *
 * Reusable form field for the coaching surfaces (signup + setup wizard).
 * Wraps shadcn Input + Label. Errored state uses the destructive token; the
 * outer page handles validation + focus delegation via refs.
 */
import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  errored?: boolean;
  disabled?: boolean;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, value, onChange, type = "text", placeholder, hint, errored, disabled, required, inputMode },
  ref,
) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={ref}
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        aria-invalid={errored || undefined}
        className={cn(
          "h-11 bg-surface",
          errored && "border-destructive focus-visible:border-destructive",
        )}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
});
