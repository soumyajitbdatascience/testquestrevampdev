"use client";

/**
 * WizardClient — client-side state machine for the 5-step setup wizard.
 *
 * Owns:
 *  - currentStep (1..5)
 *  - per-step draft values
 *  - submit handler refs (each step registers its onSubmit; Wizard's Next
 *    button calls the active step's submit, which validates locally and then
 *    POSTs to /api/coaching/setup/[step])
 *
 * The shell + each step component are dumb-ish: they accept value+handlers
 * and emit validity changes. All persistence + navigation lives here.
 */
import { useRef, useState } from "react";
import type { SetupProgress } from "@/lib/services/batch.service";
import { WizardShell, type WizardStep } from "@/components/coaching/wizard-shell";
import { StepBranding } from "./steps/step-branding";
import { StepClasses } from "./steps/step-classes";
import { StepBatch } from "./steps/step-batch";
import { StepInvite, type RosterRow, type InviteMode } from "./steps/step-invite";
import { StepDone } from "./steps/step-done";

const STEPS: WizardStep[] = [
  { key: "branding", title: "Branding"     },
  { key: "classes",  title: "Boards & classes" },
  { key: "batch",    title: "First batch"  },
  { key: "invite",   title: "Invite students" },
  { key: "done",     title: "Done"         },
];

export interface WizardBootstrap {
  centreName: string;
  orgId: number;
  progress: SetupProgress;
  initial: {
    branding: { displayName: string; city: string; logoUrl: string | null; primaryColor: string };
    classes:  { boards: string[]; classIds: number[] };
    batch:    { name: string; classId: number | null; board: string; subjects: string[]; id: number | null };
  };
  classCatalogue: Array<{ id: number; name: string }>;
}

export function WizardClient({ bootstrap }: { bootstrap: WizardBootstrap }) {
  const [currentStep, setCurrentStep] = useState<number>(Math.max(1, Math.min(5, bootstrap.progress.currentStep || 1)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(true);

  // Each step registers its submit handler before render via a ref so the
  // Next button can fire it from outside the step.
  const submitRef = useRef<(() => void) | null>(null);
  const registerSubmit = (fn: () => void) => { submitRef.current = fn; };

  // Step 4 needs to call into the same shared draft when committing.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [studentsAdded, setStudentsAdded] = useState(0);

  // Branding step state (lifted to share between submit + logo upload)
  const [brandingVal, setBrandingVal] = useState(bootstrap.initial.branding);
  const [classesVal, setClassesVal] = useState(bootstrap.initial.classes);
  const [batchVal, setBatchVal] = useState(bootstrap.initial.batch);

  async function post(step: string, body: unknown) {
    try {
      const res = await fetch(`/api/coaching/setup/${step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return (await res.json()) as { ok: boolean; data?: Record<string, unknown>; error?: string };
    } catch {
      return { ok: false as const, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  async function uploadLogo(file: File | null): Promise<string | null> {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/coaching/setup/logo", { method: "POST", body: fd });
      const data = await res.json() as { ok: boolean; data?: { url: string }; error?: string };
      if (!data.ok) { setError(data.error || "Couldn't upload that logo. Try a smaller image."); return null; }
      return data.data!.url;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return null;
    }
  }

  async function commitBranding(value: typeof brandingVal) {
    setBrandingVal(value);
    setLoading(true); setError(null);
    try {
      const r = await post("branding", value);
      if (!r.ok) { setError(r.error ?? "Couldn't save"); return; }
      setCurrentStep(2);
    } finally { setLoading(false); }
  }

  async function commitClasses(value: typeof classesVal) {
    setClassesVal(value);
    setLoading(true); setError(null);
    try {
      const r = await post("classes", value);
      if (!r.ok) { setError(r.error ?? "Couldn't save"); return; }
      setCurrentStep(3);
    } finally { setLoading(false); }
  }

  async function commitBatch(value: { name: string; classId: number | null; board: string; subjects: string[] }) {
    setBatchVal((cur) => ({ ...cur, ...value }));
    setLoading(true); setError(null);
    try {
      const r = await post("batch", { name: value.name, classId: value.classId, board: value.board, subjects: value.subjects });
      if (!r.ok) { setError(r.error ?? "Couldn't save"); return; }
      const newBatchId = Number(r.data?.batchId);
      setBatchVal((cur) => ({ ...cur, id: newBatchId }));
      setCurrentStep(4);
    } finally { setLoading(false); }
  }

  async function commitInvite(commit: { mode: InviteMode; roster?: RosterRow[] }): Promise<{ url?: string } | void> {
    if (!batchVal.id) { setError("Missing batch — go back to step 3."); return; }
    setLoading(true); setError(null);
    try {
      const r = await post("invite", { ...commit, batchId: batchVal.id });
      if (!r.ok) { setError(r.error ?? "Couldn't save"); return; }
      if (commit.mode === "link" && typeof r.data?.url === "string") {
        const url = r.data.url;
        setShareUrl(url);
        return { url };
      }
      if (commit.mode === "roster" && Array.isArray(r.data?.enrolled)) {
        setStudentsAdded(r.data.enrolled.length);
      }
      // Don't auto-advance; user reviews the share card / preview then clicks Next.
    } finally { setLoading(false); }
  }

  async function finalize() {
    setLoading(true); setError(null);
    try {
      await post("done", {});
    } finally { setLoading(false); }
  }

  function fireNext() {
    submitRef.current?.();
  }

  function backToPrev() {
    setError(null);
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  const isDoneStep = currentStep === 5;

  return (
    <WizardShell
      steps={STEPS}
      currentStep={currentStep}
      hideBack={currentStep === 1}
      hideFooter={isDoneStep}
      onBack={backToPrev}
      onNext={() => {
        if (currentStep === 4) {
          // Step 4 has its own commit baked in via registerSubmit too;
          // calling fireNext also advances after commit.
          fireNext();
          setCurrentStep(5);
        } else {
          fireNext();
        }
      }}
      nextLabel={currentStep === 4 ? "Continue" : "Save & continue"}
      loading={loading}
      nextDisabled={!valid}
    >
      {error && (
        <div className="mb-6 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {currentStep === 1 && (
        <StepBranding
          initial={brandingVal}
          loading={loading}
          onLogoUpload={uploadLogo}
          onSubmit={commitBranding}
          registerSubmit={registerSubmit}
        />
      )}
      {currentStep === 2 && (
        <StepClasses
          initial={classesVal}
          loading={loading}
          onSubmit={commitClasses}
          onValidityChange={setValid}
          registerSubmit={registerSubmit}
        />
      )}
      {currentStep === 3 && (
        <StepBatch
          initial={batchVal}
          classChoices={bootstrap.classCatalogue.filter((c) => classesVal.classIds.includes(c.id))}
          loading={loading}
          onSubmit={commitBatch}
          onValidityChange={setValid}
          registerSubmit={registerSubmit}
        />
      )}
      {currentStep === 4 && (
        <StepInvite
          centreName={brandingVal.displayName || bootstrap.centreName}
          batchName={batchVal.name}
          existingShareUrl={shareUrl}
          loading={loading}
          onCommit={commitInvite}
          onValidityChange={setValid}
          registerSubmit={registerSubmit}
        />
      )}
      {currentStep === 5 && (
        <StepDone
          batchName={batchVal.name || null}
          studentsAdded={studentsAdded}
          loading={loading}
          finalize={finalize}
        />
      )}
    </WizardShell>
  );
}
