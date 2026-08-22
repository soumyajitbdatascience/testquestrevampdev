-- Offerings for content board CBSE (Class x Subject pairs that have content)
INSERT INTO tq_offerings (boardId, classId, subjectId, sortOrder, isActive)
SELECT b.id, c.id, sj.id, 1, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Biology'
UNION ALL
SELECT b.id, c.id, sj.id, 2, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Chemistry'
UNION ALL
SELECT b.id, c.id, sj.id, 3, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Hindi'
UNION ALL
SELECT b.id, c.id, sj.id, 4, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Mathematics'
UNION ALL
SELECT b.id, c.id, sj.id, 5, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Social Science'
UNION ALL
SELECT b.id, c.id, sj.id, 6, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Biology'
UNION ALL
SELECT b.id, c.id, sj.id, 7, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Chemistry'
UNION ALL
SELECT b.id, c.id, sj.id, 8, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Mathematics'
UNION ALL
SELECT b.id, c.id, sj.id, 9, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Physics'
UNION ALL
SELECT b.id, c.id, sj.id, 10, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology'
UNION ALL
SELECT b.id, c.id, sj.id, 11, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Chemistry'
UNION ALL
SELECT b.id, c.id, sj.id, 12, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='English'
UNION ALL
SELECT b.id, c.id, sj.id, 13, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Mathematics'
UNION ALL
SELECT b.id, c.id, sj.id, 14, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Physics'
UNION ALL
SELECT b.id, c.id, sj.id, 15, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Social Science'
UNION ALL
SELECT b.id, c.id, sj.id, 16, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Biology'
UNION ALL
SELECT b.id, c.id, sj.id, 17, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Chemistry'
UNION ALL
SELECT b.id, c.id, sj.id, 18, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='English'
UNION ALL
SELECT b.id, c.id, sj.id, 19, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics'
UNION ALL
SELECT b.id, c.id, sj.id, 20, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Physics'
UNION ALL
SELECT b.id, c.id, sj.id, 21, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Social Science'
UNION ALL
SELECT b.id, c.id, sj.id, 22, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology'
UNION ALL
SELECT b.id, c.id, sj.id, 23, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Chemistry'
UNION ALL
SELECT b.id, c.id, sj.id, 24, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='English'
UNION ALL
SELECT b.id, c.id, sj.id, 25, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics'
UNION ALL
SELECT b.id, c.id, sj.id, 26, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Physics'
UNION ALL
SELECT b.id, c.id, sj.id, 27, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Social Science'
UNION ALL
SELECT b.id, c.id, sj.id, 28, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 11' AND sj.name='Biology'
UNION ALL
SELECT b.id, c.id, sj.id, 29, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 11' AND sj.name='Physics'
UNION ALL
SELECT b.id, c.id, sj.id, 30, 1 FROM tq_boards b, tq_classes c, tq_subjects sj WHERE b.code='CBSE' AND c.name='Class 12' AND sj.name='Biology';
