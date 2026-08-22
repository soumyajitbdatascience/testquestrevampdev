import { teardown, snapshot, prisma } from "./helpers/db";
import { teardownStudents } from "./helpers/student";

/**
 * Runs once after the whole suite, pass or fail. Prints what it removed so the
 * report can state "left as found" as a fact rather than an intention.
 */
export default async function globalTeardown() {
  const removed = [...(await teardown()), ...(await teardownStudents())];
  const after = await snapshot();
  console.log(`\n[teardown] removed: ${removed.length ? removed.join(", ") : "nothing"}`);
  console.log(`[teardown] final counts: ${JSON.stringify(after)}`);
  await prisma.$disconnect();
}
