"use client";

/**
 * Branding settings — client form (Task 3.4).
 *
 * Layout: two-column grid (logos on left, colors + text fields on right).
 * Sticky save button at the bottom; brief "Saved" pill next to it matches the
 * org-detail CRM pattern. Inline error string surfaces server validation.
 *
 * Logo uploads reuse /api/coaching/setup/logo?variant=light|dark — each variant
 * is uploaded independently when the user picks a file, and the resulting URL
 * is merged into the form state. The PUT to /api/coaching/settings/branding
 * persists the URLs + the rest of the form.
 */
import { useState } from "react";
import { LogoDropzone } from "@/components/coaching/logo-dropzone";
import { ColorSwatchPicker } from "@/components/coaching/color-swatch-picker";
import { Field } from "@/components/coaching/field";
import { Button } from "@/components/ui/button";

export interface WhiteLabelForm {
  primaryColor: string;
  secondaryColor: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  displayName: string;
  supportEmail: string;
  supportPhone: string;
}

interface Props {
  initial: WhiteLabelForm;
  trialPreview: boolean;
}

export function BrandingSettingsClient({ initial, trialPreview }: Props) {
  const [form, setForm] = useState<WhiteLabelForm>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lightUploading, setLightUploading] = useState(false);
  const [darkUploading, setDarkUploading] = useState(false);

  function set<K extends keyof WhiteLabelForm>(key: K, value: WhiteLabelForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(null);
  }

  async function uploadLogo(variant: "light" | "dark", file: File | null) {
    if (!file) {
      set(variant === "light" ? "logoLightUrl" : "logoDarkUrl", "");
      return;
    }
    const setBusy = variant === "light" ? setLightUploading : setDarkUploading;
    setBusy(true); setErr(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/coaching/setup/logo?variant=${variant}`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!data.ok) { setErr(data.error || "Couldn't upload that logo."); return; }
      set(variant === "light" ? "logoLightUrl" : "logoDarkUrl", data.data.url);
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true); setErr(null); setSaved(null);
    try {
      const res = await fetch("/api/coaching/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(data.error || "Couldn't save.");
        return;
      }
      setForm({ ...form, ...data.data.whiteLabel });
      setSaved("Saved.");
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {trialPreview && (
        <div className="rounded-[12px] border border-primary/30 bg-primary-dim px-4 py-3 text-xs text-foreground">
          You&apos;re previewing white-label during your trial. Upgrade to Growth or Pro
          before your trial ends to keep these settings.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left column — logos */}
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-xl">Logos</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload separate variants for light and dark backgrounds. PNG, JPG, or SVG, up to 2 MB.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Light-mode logo</p>
            <p className="text-xs text-muted-foreground">
              Shown on light backgrounds (printed reports, emails).
            </p>
            <LogoDropzone
              existingUrl={form.logoLightUrl || null}
              onFile={(f) => uploadLogo("light", f)}
              disabled={lightUploading}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Dark-mode logo</p>
            <p className="text-xs text-muted-foreground">
              Shown on dark backgrounds (the in-app student dashboard).
            </p>
            <LogoDropzone
              existingUrl={form.logoDarkUrl || null}
              onFile={(f) => uploadLogo("dark", f)}
              disabled={darkUploading}
            />
          </div>
        </section>

        {/* Right column — colors + text */}
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-xl">Brand colours</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick a primary swatch, or paste any CSS colour value below.
            </p>
            <div className="mt-4">
              <ColorSwatchPicker
                value={form.primaryColor}
                onChange={(v) => set("primaryColor", v)}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                id="primaryColor"
                label="Primary colour"
                value={form.primaryColor}
                onChange={(v) => set("primaryColor", v)}
                placeholder="oklch(0.78 0.17 65)"
              />
              <Field
                id="secondaryColor"
                label="Secondary colour"
                value={form.secondaryColor}
                onChange={(v) => set("secondaryColor", v)}
                placeholder="#1a2b3c"
              />
            </div>
          </div>

          <div>
            <h2 className="font-display text-xl">Centre details</h2>
            <div className="mt-4 space-y-4">
              <Field
                id="displayName"
                label="Display name"
                value={form.displayName}
                onChange={(v) => set("displayName", v)}
                placeholder="Sunrise Coaching Centre"
                hint="Shown to students wherever your centre name appears."
              />
              <Field
                id="supportEmail"
                label="Support email"
                value={form.supportEmail}
                onChange={(v) => set("supportEmail", v)}
                placeholder="support@yourcentre.in"
                type="email"
              />
              <Field
                id="supportPhone"
                label="Support phone"
                value={form.supportPhone}
                onChange={(v) => set("supportPhone", v)}
                placeholder="+91 90000 00000"
                inputMode="tel"
              />
            </div>
          </div>
        </section>
      </div>

      {err && (
        <p className="text-sm text-destructive" role="alert">{err}</p>
      )}

      <div className="sticky bottom-0 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 bg-background/95 backdrop-blur border-t">
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving || lightUploading || darkUploading}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && (
            <span className="inline-flex items-center rounded-full bg-primary-dim text-primary px-3 py-1 text-[11px] font-medium">
              {saved}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
