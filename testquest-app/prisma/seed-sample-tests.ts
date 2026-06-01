import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find Class 10 → Mathematics → Real Numbers (the seeded chapter)
  const mathSubject = await prisma.subject.findFirst({
    where: { name: "Mathematics", class: { name: "Class 10" } },
    include: { class: true, chapters: true },
  });

  if (!mathSubject || mathSubject.chapters.length === 0) {
    console.log("Run seed.ts first — no Mathematics subject or chapters found");
    return;
  }

  const realNumbers = mathSubject.chapters.find((c) => c.name === "Real Numbers")!;
  const polynomials = mathSubject.chapters.find((c) => c.name === "Polynomials")!;

  // Create questions for Real Numbers
  const questions = [
    {
      chapterId: realNumbers.id,
      type: "SINGLE_MCQ" as const,
      text: "Which of the following is an irrational number?",
      explanation: "√2 cannot be expressed as a fraction of two integers, so it is irrational.",
      options: [
        { label: "A", text: "0.5", isCorrect: false },
        { label: "B", text: "√2", isCorrect: true },
        { label: "C", text: "3/4", isCorrect: false },
        { label: "D", text: "0.333...", isCorrect: false },
      ],
    },
    {
      chapterId: realNumbers.id,
      type: "SINGLE_MCQ" as const,
      text: "The HCF of 96 and 404 is:",
      explanation: "Using Euclid's algorithm: 404 = 96 × 4 + 20, 96 = 20 × 4 + 16, 20 = 16 × 1 + 4, 16 = 4 × 4. So HCF = 4.",
      options: [
        { label: "A", text: "2", isCorrect: false },
        { label: "B", text: "4", isCorrect: true },
        { label: "C", text: "8", isCorrect: false },
        { label: "D", text: "12", isCorrect: false },
      ],
    },
    {
      chapterId: realNumbers.id,
      type: "MULTI_MCQ" as const,
      text: "Which of the following are rational numbers?",
      explanation: "0.75, 22/7 (a fraction), and -3 are all rational. π is irrational.",
      options: [
        { label: "A", text: "0.75", isCorrect: true },
        { label: "B", text: "π", isCorrect: false },
        { label: "C", text: "22/7", isCorrect: true },
        { label: "D", text: "-3", isCorrect: true },
      ],
    },
    {
      chapterId: realNumbers.id,
      type: "FILL_IN_BLANK" as const,
      text: "The decimal expansion of 13/3125 will terminate after ___ decimal places.",
      correctText: "5",
      explanation: "3125 = 5⁵, so the decimal expansion terminates after 5 places.",
    },
    {
      chapterId: realNumbers.id,
      type: "SINGLE_MCQ" as const,
      text: "If two positive integers a and b are written as a = x³y² and b = xy³, where x and y are prime numbers, then HCF(a, b) is:",
      explanation: "HCF takes the lowest power of common primes: x¹ × y² = xy²",
      options: [
        { label: "A", text: "xy", isCorrect: false },
        { label: "B", text: "xy²", isCorrect: true },
        { label: "C", text: "x³y³", isCorrect: false },
        { label: "D", text: "x²y²", isCorrect: false },
      ],
    },
  ];

  for (const q of questions) {
    const { options, ...questionData } = q as typeof q & { options?: { label: string; text: string; isCorrect: boolean }[] };
    await prisma.question.create({
      data: {
        ...questionData,
        marks: 1,
        options: options ? { create: options } : undefined,
      },
    });
  }
  console.log(`Created ${questions.length} sample questions`);

  // Create a FREE test
  const allQuestions = await prisma.question.findMany({
    where: { chapterId: realNumbers.id },
    select: { id: true, marks: true },
  });

  const freeTest = await prisma.test.create({
    data: {
      classId: mathSubject.classId,
      subjectId: mathSubject.id,
      name: "Real Numbers — Sample Test (Free)",
      description: "Try this free sample test to experience the platform. Covers basic concepts of real numbers.",
      durationMinutes: 15,
      totalMarks: allQuestions.reduce((s, q) => s + q.marks, 0),
      isFree: true,
      price: 0,
      questions: {
        create: allQuestions.map((q, i) => ({ questionId: q.id, sortOrder: i + 1 })),
      },
    },
  });
  console.log(`Created free test: "${freeTest.name}"`);

  // Create a PAID test
  const paidTest = await prisma.test.create({
    data: {
      classId: mathSubject.classId,
      subjectId: mathSubject.id,
      name: "Real Numbers — Chapter Mastery (Paid)",
      description: "Complete chapter test with detailed solutions and explanations. Includes 5 carefully selected questions.",
      durationMinutes: 20,
      totalMarks: allQuestions.reduce((s, q) => s + q.marks, 0),
      isFree: false,
      price: 49,
      questions: {
        create: allQuestions.map((q, i) => ({ questionId: q.id, sortOrder: i + 1 })),
      },
    },
  });
  console.log(`Created paid test: "${paidTest.name}" — ₹${paidTest.price}`);

  // Create a Practice test
  const practiceTest = await prisma.test.create({
    data: {
      classId: mathSubject.classId,
      subjectId: mathSubject.id,
      name: "Real Numbers — Practice Mode",
      description: "Untimed practice with instant feedback. Perfect for revision.",
      durationMinutes: 30,
      totalMarks: allQuestions.reduce((s, q) => s + q.marks, 0),
      isFree: true,
      isPractice: true,
      price: 0,
      questions: {
        create: allQuestions.map((q, i) => ({ questionId: q.id, sortOrder: i + 1 })),
      },
    },
  });
  console.log(`Created practice test: "${practiceTest.name}"`);

  console.log("\nDone! Browse tests at http://localhost:3000/tests");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
