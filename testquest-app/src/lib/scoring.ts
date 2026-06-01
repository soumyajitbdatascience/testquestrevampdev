import { prisma } from "./db";

export async function scoreAttempt(attemptId: number) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          selectedOption: true,
        },
      },
      test: {
        include: {
          questions: {
            include: {
              question: {
                include: { options: true },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) throw new Error("Attempt not found");

  let totalScore = 0;

  for (const tq of attempt.test.questions) {
    const question = tq.question;
    const answer = attempt.answers.find((a) => a.questionId === question.id);

    if (!answer) continue;

    let isCorrect = false;
    let marks = 0;

    switch (question.type) {
      case "SINGLE_MCQ": {
        if (answer.selectedOptionId) {
          const correctOption = question.options.find((o) => o.isCorrect);
          isCorrect = correctOption?.id === answer.selectedOptionId;
        }
        break;
      }
      case "MULTI_MCQ": {
        // All-or-nothing: student must select ALL correct options and no wrong ones
        if (answer.selectedOptionId) {
          // For multi-MCQ, selectedOptionId stores the first selection
          // but we need to check all answers for this question
          // In practice, multi-MCQ answers are stored as comma-separated IDs in fillAnswer
          const selectedIds = (answer.fillAnswer || "")
            .split(",")
            .filter(Boolean)
            .map(Number);
          const correctIds = question.options
            .filter((o) => o.isCorrect)
            .map((o) => o.id)
            .sort();
          const sortedSelected = [...selectedIds].sort();
          isCorrect =
            correctIds.length === sortedSelected.length &&
            correctIds.every((id, i) => id === sortedSelected[i]);
        }
        break;
      }
      case "FILL_IN_BLANK": {
        if (answer.fillAnswer && question.correctText) {
          const accepted = question.correctText
            .split(",")
            .map((s) => s.trim().toLowerCase());
          isCorrect = accepted.includes(answer.fillAnswer.trim().toLowerCase());
        }
        break;
      }
    }

    if (isCorrect) marks = question.marks;

    await prisma.attemptAnswer.update({
      where: { id: answer.id },
      data: { isCorrect, marksAwarded: marks },
    });

    totalScore += marks;
  }

  const percentage =
    attempt.totalMarks > 0
      ? Number(((totalScore / attempt.totalMarks) * 100).toFixed(2))
      : 0;

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { score: totalScore, percentage },
  });

  return { score: totalScore, totalMarks: attempt.totalMarks, percentage };
}
