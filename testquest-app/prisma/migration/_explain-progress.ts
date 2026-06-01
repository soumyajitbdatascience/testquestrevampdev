import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const total = await p.question.count({ where: { isLegacy: true } });
  const withExplanation = await p.question.count({ where: { isLegacy: true, explanation: { not: null } } });
  const options = await p.questionOption.count();
  console.log(`Questions: ${total.toLocaleString()}`);
  console.log(`With explanation: ${withExplanation.toLocaleString()} (${((withExplanation/total)*100).toFixed(1)}%)`);
  console.log(`Options: ${options.toLocaleString()}`);
  await p.$disconnect();
})();
