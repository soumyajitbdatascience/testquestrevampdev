# Testquest — Clean Schema Design (Decoupled Model)

**Version 1.0 · For the new clean database (`u710649289_TquestTestEnv`) · Handoff-ready for Claude Code**

> **Plain-English purpose:** this is the shape of the new clean database. It uses the "configure once, map many" idea so that scaling to 28 boards later is cheap. Read the plain-English part of each section; the SQL underneath is what Claude Code (or you) actually runs.

---

## 1. The idea in one picture

```
MASTERS (configure once)      MAPS (who offers what)        CONTENT (hangs off an Offering)
────────────────────────      ──────────────────────        ───────────────────────────────
tq_boards    (CBSE, ICSE…)    tq_board_classes              tq_chapters   → offeringId
tq_classes   (Class 6…12)       (which classes a board       tq_tests      → offeringId
tq_subjects  (Maths, Sci…)       offers)                     tq_free_tests → offeringId
                                                             tq_questions  → shared bank
                              tq_offerings                                   (subject + chapter)
                               (one row per real
                                Board+Class+Subject)
```

Three layers, three jobs:

- **Masters** — the reusable building blocks. "Class 10" and "Mathematics" each exist **once**, shared by every board.
- **Maps** — small link tables that say which board offers which class.
- **Offerings** — the shelf. One row per real *Board + Class + Subject* (e.g. "CBSE · Class 10 · Maths"). **All content sits on the offering**, so CBSE's Maths and Odisha's Maths never mix even though they share the name.

Reminder: an **Offering is not a subscription.** The offering is a shelf the admin builds. The subscription is a key a student buys that unlocks a group of shelves.

---

## 2. Masters

### 2.1 Boards — already exists

Plain English: the exam boards a student picks first. You already created CBSE, ICSE, State, Odisha.

```
tq_boards ( id, name, code, sortOrder, isActive, createdAt )
```

### 2.2 Classes — shared master (one row per class, no board here)

Plain English: Class 6 to Class 12, existing **once**. A board does not "own" a class — it just *offers* it (see the map below). `legacyId` remembers the old id so we can re-link old content later.

```sql
-- tq_classes is the shared list. If you earlier added a boardId column, drop it —
-- classes are board-agnostic now; the board link lives in tq_board_classes.
CREATE TABLE IF NOT EXISTS tq_classes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  legacyId  INT NULL UNIQUE,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2.3 Subjects — shared master (one row per subject, no class here)

Plain English: "Mathematics", "Science", "English" existing **once**. Today's table ties a subject to a single class — in the new model we remove that, because the same subject is reused across classes and boards. The specific "CBSE Class 10 Maths" combination is expressed by an **Offering**, not by the subject row.

```sql
CREATE TABLE IF NOT EXISTS tq_subjects (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(200) NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- If tq_subjects already exists with a classId column, remove it:
-- ALTER TABLE tq_subjects DROP COLUMN classId;
-- (Subject↔legacy ids are many-to-one after dedup, so that mapping lives in a
--  separate helper table built during the Subjects migration step, not here.)
```

---

## 3. Maps

### 3.1 Board ↔ Classes

Plain English: one row for each "this board offers this class." Adding a new board later = just add a few rows here, no re-typing of classes.

```sql
CREATE TABLE IF NOT EXISTS tq_board_classes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  boardId   INT NOT NULL,
  classId   INT NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isActive  TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_board_class (boardId, classId),
  CONSTRAINT fk_bc_board FOREIGN KEY (boardId) REFERENCES tq_boards(id),
  CONSTRAINT fk_bc_class FOREIGN KEY (classId) REFERENCES tq_classes(id)
);
```

---

## 4. Offerings — the shelf

Plain English: one row for each real *Board + Class + Subject*. This is where chapters, tests, videos, and the free sample attach. Creating the offering is what makes "CBSE · Class 10 · Maths" a real place content can live.

```sql
CREATE TABLE IF NOT EXISTS tq_offerings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  boardId    INT NOT NULL,
  classId    INT NOT NULL,
  subjectId  INT NOT NULL,
  isActive   TINYINT(1) NOT NULL DEFAULT 1,
  sortOrder  INT NOT NULL DEFAULT 0,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_offering (boardId, classId, subjectId),
  CONSTRAINT fk_off_board   FOREIGN KEY (boardId)   REFERENCES tq_boards(id),
  CONSTRAINT fk_off_class   FOREIGN KEY (classId)   REFERENCES tq_classes(id),
  CONSTRAINT fk_off_subject FOREIGN KEY (subjectId) REFERENCES tq_subjects(id)
);
```

---

## 5. Content attaches to the Offering (not the masters)

Plain English: the golden rule. A chapter belongs to an **offering**, never to a bare subject — otherwise it would leak into every board. Questions stay in one shared bank and carry a subject + (optionally) a chapter.

```
tq_chapters   ( id, offeringId → tq_offerings, name, sortOrder, isActive, legacyId )
tq_tests      ( id, offeringId → tq_offerings, name, durationMinutes, totalMarks, isFree, price, … )
tq_free_tests ( offeringId → tq_offerings, testId → tq_tests )   -- one sample per offering
tq_questions  ( id, subjectId → tq_subjects, chapterId → tq_chapters (nullable), text, type, … )
tq_test_questions ( testId → tq_tests, questionId → tq_questions )  -- shared bank, many-to-many
```

Questions are already a shared bank in the current app — that part stays as-is.

---

## 6. Redone Class migration (decoupled style)

This replaces the earlier "board owns class" SQL. Content board assumed = **CBSE** — change `'CBSE'` if your existing questions actually belong to another board.

**Step A — insert the 7 class masters (once):**

```sql
INSERT INTO tq_classes (name, sortOrder, isActive, legacyId, createdAt, updatedAt) VALUES
('Class 6', 6, 1, 42, NOW(), NOW()),
('Class 7', 7, 1, 43, NOW(), NOW()),
('Class 8', 8, 1, 37, NOW(), NOW()),
('Class 9', 9, 1, 44, NOW(), NOW()),
('Class 10',10, 1, 45, NOW(), NOW()),
('Class 11',11, 1, 46, NOW(), NOW()),
('Class 12',12, 1, 36, NOW(), NOW());
```

**Step B — map all 7 to the content board (CBSE):**

```sql
INSERT INTO tq_board_classes (boardId, classId, sortOrder, isActive, createdAt)
SELECT (SELECT id FROM tq_boards WHERE code = 'CBSE'), c.id, c.sortOrder, 1, NOW()
FROM tq_classes c;
```

**Step C — check it:**

```sql
SELECT b.name AS board, c.name AS class, c.sortOrder, c.legacyId
FROM tq_board_classes bc
JOIN tq_boards  b ON b.id = bc.boardId
JOIN tq_classes c ON c.id = bc.classId
ORDER BY b.name, c.sortOrder;
```

Expect 7 rows: CBSE · Class 6 → Class 12, each with its old id in `legacyId`. The other boards show nothing yet — correct; they get mapped when they have content.

---

## 7. What this changes in the current app (Claude Code rework list)

The running app was built slightly differently, so adopting this model means Claude Code updates:

1. **`tq_subjects`** — remove `classId`; it becomes a pure master.
2. **New tables** — `tq_board_classes`, `tq_offerings`.
3. **`tq_chapters`** — replace `(boardId, classId, subjectId)` with a single `offeringId`.
4. **`tq_tests`** — replace `(classId, subjectId)` with `offeringId`.
5. **`tq_free_tests`** — point at `offeringId`.
6. **Prisma schema + admin screens + queries** — updated to match: Classes screen shows classes; a new Board-Classes mapping screen; Subjects become a master list; an Offerings screen ties them; content screens attach to an offering.
7. **Watch query depth** — deeper joins (Board→Class→Subject→Offering→Chapter); index the foreign keys and keep list queries under Hostinger's 10-second limit.

---

## 8. Migration order (the sequence we follow)

1. **Boards** — done (4 exist).
2. **Classes** — Section 6 above (masters + board map).  ← we are here
3. **Subjects** — dedupe the messy 982 legacy rows into a clean master list (this is the big cleaning step; switches from hand-typed rows to a copy script + a legacy→master map).
4. **Offerings** — generate one row per real Board+Class+Subject for the content board.
5. **Chapters** — create/attach under offerings.
6. **Questions** — copy the shared bank, normalize the answers, link to subjects/chapters.
7. **Tests** — attach to offerings; wire the shared bank via `tq_test_questions`.
8. **Verify** — counts and spot-checks before anything goes live.

---

## 9. Future: 28 state boards (design already accounts for it)

- Adding board #N = insert one `tq_boards` row + a few `tq_board_classes` rows + its offerings. No re-typing of classes or subjects.
- **Language** is the one thing to plan for but not build yet: regional boards need display names like "ଗଣିତ"/"கணிதம்". Content already separates naturally (different offerings), but master display names will eventually need a small translations layer. Design leaves room for it; don't build it now.
