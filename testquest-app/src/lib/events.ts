/**
 * Funnel analytics into tq_events. Fire-and-forget: tracking must never
 * break a user-facing flow, so failures are swallowed.
 */
import { prisma } from "@/lib/db";

export async function track(
  name: string,
  studentId: number | null,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        name,
        studentId,
        // MariaDB stores JSON as LONGTEXT, so the column is a string.
        properties: properties ? JSON.stringify(properties) : null,
      },
    });
  } catch {
    // never throw from analytics
  }
}
