import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Map raw auth-layer API errors ("Unauthorized"/"Forbidden") to copy a
 * student can act on. Any other message passes through unchanged.
 */
export function friendlyAuthError(message: string | null | undefined, fallback = "Something went wrong"): string {
  if (!message) return fallback;
  if (message === "Unauthorized") return "Please sign in to continue.";
  if (message === "Forbidden") return "This account can't do this — please sign in with a student account.";
  return message;
}
