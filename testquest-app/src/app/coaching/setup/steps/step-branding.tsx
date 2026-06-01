"use client";

/**
 * Step 1 — Branding. Logo / display name / city / primary color.
 *
 * Skippable (logo only). Display name + city + color are required-but-prefilled
 * from the org row, so "Next" is always enabled.
 */
import { useState } from "react";
import { Field } from "@/components/coaching/field";
import { LogoDropzone } from "@/components/coaching/logo-dropzone";
import { ColorSwatchPicker, BRAND_SWATCHES } from "@/components/coaching/color-swatch-picker";

export interface StepBrandingValue {
  displayName: string;
  city: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface StepBrandingProps {
  initial: StepBrandingValue;
  loading: boolean;
  onLogoUpload: (file: File | null) => Promise<string | null>; // returns persisted URL or null
  onSubmit: (value: StepBrandingValue) => void;
  registerSubmit: (fn: () => void) => void;
}

export function StepBranding({ initial, loading, onLogoUpload, onSubmit, registerSubmit }: StepBrandingProps) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [city, setCity] = useState(initial.city);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor || BRAND_SWATCHES[0].value);
  const [logoBusy, setLogoBusy] = useState(false);

  function submit() {
    onSubmit({ displayName: displayName.trim(), city: city.trim(), logoUrl, primaryColor });
  }
  registerSubmit(submit);

  async function handleFile(file: File | null) {
    if (!file) { setLogoUrl(null); return; }
    setLogoBusy(true);
    try {
      const url = await onLogoUpload(file);
      if (url) setLogoUrl(url);
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-primary">Step 1</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">
          Your <em className="text-primary">brand.</em>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set how your centre shows up to students and parents. Skip the logo if you're not ready.
        </p>
      </header>

      <section className="space-y-2">
        <p className="text-sm font-medium">Logo</p>
        <LogoDropzone existingUrl={logoUrl} onFile={handleFile} disabled={loading || logoBusy} />
      </section>

      <Field
        id="displayName"
        label="Centre display name"
        value={displayName}
        onChange={setDisplayName}
        placeholder="Sunrise Coaching Centre"
        hint="What students see in their app and on report cards."
        disabled={loading}
      />

      <Field
        id="city"
        label="City"
        value={city}
        onChange={setCity}
        placeholder="Pune"
        disabled={loading}
      />

      <section className="space-y-3">
        <p className="text-sm font-medium">Primary brand color</p>
        <ColorSwatchPicker value={primaryColor} onChange={setPrimaryColor} />
        <p className="text-[11px] text-muted-foreground">
          Used to tint your branded reports on the Pro plan. Saffron is our default.
        </p>
      </section>
    </div>
  );
}
