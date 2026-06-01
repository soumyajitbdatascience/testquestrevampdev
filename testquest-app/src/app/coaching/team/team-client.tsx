"use client";

/**
 * TeamClient — invite form + member list + pending invites.
 *
 * Owners see the invite form and revoke/cancel/resend actions. Non-owners
 * (TEACHER, ADMIN) see read-only.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Mail,
  MoreVertical,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/coaching/empty-state";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "ADMIN" | "TEACHER";

export interface MemberDto {
  membershipId: number;
  userId: number;
  role: Role | "STUDENT" | "PARENT";
  name: string | null;
  email: string | null;
  joinedAt: string;
}

export interface PendingDto {
  id: number;
  email: string;
  name: string;
  role: "ADMIN" | "TEACHER";
  invitedAt: string;
  expiresAt: string;
}

interface Props {
  initialMembers: MemberDto[];
  initialPending: PendingDto[];
  isOwner: boolean;
  selfUserId: number;
}

function relative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 24 * 3600 * 1000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function roleBadge(role: string): string {
  switch (role) {
    case "OWNER":  return "bg-primary-dim text-primary";
    case "ADMIN":  return "bg-blue-500/15 text-blue-400";
    case "TEACHER": return "bg-green-500/15 text-green-400";
    default: return "bg-surface-hi text-muted-foreground";
  }
}

export function TeamClient({ initialMembers, initialPending, isOwner, selfUserId }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [pending, setPending] = useState(initialPending);

  // Invite form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"TEACHER" | "ADMIN">("TEACHER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Per-row action state — we key by id to allow concurrent ops to display.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  function markBusy(key: string, on: boolean) {
    setBusy((cur) => {
      const next = new Set(cur);
      if (on) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    if (name.trim().length < 2) { setInviteError("Enter the teammate's full name."); return; }
    if (!email.includes("@")) { setInviteError("That email doesn't look right."); return; }
    setInviting(true);
    try {
      const res = await fetch("/api/coaching/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), role }),
      });
      const data = await res.json();
      if (!data.ok) {
        setInviteError(data.error || "Couldn't send the invite. Try again.");
        return;
      }
      setPending((cur) => [data.data.invite, ...cur]);
      setInviteSuccess(`Invite sent to ${email.trim()}.`);
      setName(""); setEmail(""); setRole("TEACHER");
    } catch {
      setInviteError("Couldn't reach the server. Check your connection and try again.");
    } finally { setInviting(false); }
  }

  async function revoke(membershipId: number, displayName: string | null) {
    if (!confirm(`Revoke ${displayName ?? "this teammate"}? They'll lose access immediately.`)) return;
    const key = `member:${membershipId}`;
    markBusy(key, true); setActionError(null);
    try {
      const res = await fetch(`/api/coaching/team/${membershipId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) { setActionError(data.error || "Couldn't revoke. Try again."); return; }
      setMembers((cur) => cur.filter((m) => m.membershipId !== membershipId));
      router.refresh();
    } catch {
      setActionError("Couldn't reach the server. Check your connection and try again.");
    } finally { markBusy(key, false); }
  }

  async function cancel(inviteId: number) {
    const key = `pending:${inviteId}`;
    markBusy(key, true); setActionError(null);
    try {
      const res = await fetch(`/api/coaching/team/invites/${inviteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) { setActionError(data.error || "Couldn't cancel. Try again."); return; }
      setPending((cur) => cur.filter((p) => p.id !== inviteId));
    } catch {
      setActionError("Couldn't reach the server. Check your connection and try again.");
    } finally { markBusy(key, false); }
  }

  async function resend(inviteId: number, toEmail: string) {
    const key = `pending:${inviteId}`;
    markBusy(key, true); setActionError(null);
    try {
      const res = await fetch(`/api/coaching/team/invites/${inviteId}`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) { setActionError(data.error || "Couldn't resend. Try again."); return; }
      setInviteSuccess(`Reminder sent to ${toEmail}.`);
    } catch {
      setActionError("Couldn't reach the server. Check your connection and try again.");
    } finally { markBusy(key, false); }
  }

  const totalSeats = members.length + pending.length;
  const ownerOnly = members.length === 1 && pending.length === 0 && members[0]?.userId === selfUserId;

  return (
    <div className="mt-8 space-y-10">
      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-[12px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-destructive/70 hover:text-destructive shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Invite form (owners only) */}
      {isOwner && (
        <section className="rounded-[18px] border bg-surface p-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-dim text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg">Invite a teammate</h2>
          </div>

          <form onSubmit={submitInvite} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <div className="space-y-1">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                placeholder="Priya Raman"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={inviting}
                className="h-10 bg-surface-hi/30"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="priya@yourcentre.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviting}
                className="h-10 bg-surface-hi/30"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "TEACHER" | "ADMIN")}
                disabled={inviting}
                className="h-10 rounded-md border bg-surface-hi/30 px-3 text-sm"
              >
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <Button type="submit" disabled={inviting} className="h-10">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-1.5">{inviting ? "Sending…" : "Send invite"}</span>
            </Button>
          </form>

          {inviteError && (
            <p className="mt-3 text-xs text-destructive">{inviteError}</p>
          )}
          {inviteSuccess && !inviteError && (
            <p className="mt-3 text-xs text-primary">{inviteSuccess}</p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Admins can manage batches and billing. Teachers can run batches and assignments.
          </p>
        </section>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-3">Pending invites</h2>
          <div className="rounded-[14px] border bg-surface divide-y">
            {pending.map((p) => {
              const k = `pending:${p.id}`;
              const isBusy = busy.has(k);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-hi text-xs text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <span className={cn("text-[10px] font-medium uppercase tracking-widest rounded-full px-2.5 py-1", roleBadge(p.role))}>
                    {p.role}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Invited {relative(p.invitedAt)} · expires {relative(p.expiresAt)}
                  </span>
                  {isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/5" aria-label="Actions">
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => resend(p.id, p.email)} disabled={isBusy}>
                          <Send className="mr-2 h-3.5 w-3.5" />
                          Resend invite
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => cancel(p.id)} disabled={isBusy} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Cancel invite
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Active members */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-xl">Members</h2>
          <span className="text-xs text-muted-foreground">{totalSeats} {totalSeats === 1 ? "seat used" : "seats used"}</span>
        </div>
        {ownerOnly ? (
          <EmptyState
            icon={Users}
            title="It's just you so far."
            body="Invite a teacher to share batches and split the load. They'll see their assigned batches as soon as they accept."
          />
        ) : (
          <div className="rounded-[14px] border bg-surface divide-y">
            {members.map((m) => {
              const k = `member:${m.membershipId}`;
              const isBusy = busy.has(k);
              const isSelf = m.userId === selfUserId;
              const canRevoke = isOwner && !isSelf && m.role !== "OWNER";
              const initials = (m.name || m.email || "?").charAt(0).toUpperCase();
              return (
                <div key={m.membershipId} className="flex items-center gap-3 px-4 py-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-hi text-xs font-medium text-foreground/90">
                    {initials}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.name || "—"}
                      {isSelf && <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.email ?? "—"}</p>
                  </div>
                  <span className={cn("text-[10px] font-medium uppercase tracking-widest rounded-full px-2.5 py-1", roleBadge(m.role))}>
                    {m.role}
                  </span>
                  <span className="hidden sm:inline text-[11px] text-muted-foreground">
                    joined {relative(m.joinedAt)}
                  </span>
                  {canRevoke ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/5" aria-label="Actions">
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => revoke(m.membershipId, m.name)}
                          disabled={isBusy}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Revoke access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="inline-block w-8" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
