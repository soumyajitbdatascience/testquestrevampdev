"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { markOnboardingDismissed } from "@/lib/services/batch.service";

export async function coachingLogout() {
  const store = await cookies();
  store.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  redirect("/coaching/login");
}

export async function dismissOnboarding() {
  const session = await getSession();
  if (!session?.orgId) return;
  await markOnboardingDismissed(session.orgId);
  revalidatePath("/coaching/dashboard");
}
