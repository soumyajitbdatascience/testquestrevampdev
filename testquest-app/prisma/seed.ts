import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.admin.upsert({
    where: { email: "admin@testquest.in" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@testquest.in",
      passwordHash: adminPassword,
    },
  });
  console.log("Admin created: admin@testquest.in / admin123");

  // Create classes 6-12
  const classes = [
    { name: "Class 6", sortOrder: 6 },
    { name: "Class 7", sortOrder: 7 },
    { name: "Class 8", sortOrder: 8 },
    { name: "Class 9", sortOrder: 9 },
    { name: "Class 10", sortOrder: 10 },
    { name: "Class 11", sortOrder: 11 },
    { name: "Class 12", sortOrder: 12 },
  ];

  for (const cls of classes) {
    await prisma.class.upsert({
      where: { id: cls.sortOrder },
      update: {},
      create: cls,
    });
  }
  console.log("Classes 6-12 created");

  // Create sample subjects for Class 10
  const class10 = await prisma.class.findFirst({ where: { name: "Class 10" } });
  if (class10) {
    const subjects = ["Mathematics", "Science", "English", "Social Science", "Hindi"];
    for (let i = 0; i < subjects.length; i++) {
      const subject = await prisma.subject.upsert({
        where: { id: i + 1 },
        update: {},
        create: { classId: class10.id, name: subjects[i], sortOrder: i + 1 },
      });

      // Create sample chapters for Mathematics
      if (subjects[i] === "Mathematics") {
        const chapters = [
          "Real Numbers",
          "Polynomials",
          "Pair of Linear Equations",
          "Quadratic Equations",
          "Arithmetic Progressions",
          "Triangles",
          "Coordinate Geometry",
          "Trigonometry",
          "Areas Related to Circles",
          "Statistics",
        ];
        for (let j = 0; j < chapters.length; j++) {
          await prisma.chapter.upsert({
            where: { id: j + 1 },
            update: {},
            create: { subjectId: subject.id, name: chapters[j], sortOrder: j + 1 },
          });
        }
        console.log("Sample chapters created for Mathematics");
      }
    }
    console.log("Sample subjects created for Class 10");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
