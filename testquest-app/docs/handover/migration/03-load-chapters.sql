-- Chapters per offering. One INSERT per row (safe). Re-runnable-ish.
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Hindi';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'History', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 6' AND sj.name='Social Science';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 7' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Cell Structure And Function', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Conservation Of Plants And Animals', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Crop Production And Management', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Microorganisms', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Pollution Of Air And Water', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Reaching The Age Of Adolescence', 7, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Reproduction In Animals', 8, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Chemical Effect Of Electric Current And Magnetism', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Coal And Petroleum', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Combustion And Flame', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Metals & Non Metals', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Synthetic Fibres And Plastics', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='English';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 8' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Diversity In Living World', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Fundamental Unit Of Life', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Improvement In Food Resources', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Natural Resources', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Tissues', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Why Do We Fall Ill', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Atomic Structure', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Atoms And Molecules', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Is Matter Around Us Pure', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Matter In Our Surrounding', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='English';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Circle', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Coordinate Geometry', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Heron''s Formula', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Introduction To Euclid''s Geometry', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Linear Equation in Two Variable', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Lines & Angles', 7, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Number System', 8, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Polynomials', 9, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Quadrilateral', 10, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Statistics', 11, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Triangles', 12, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 9' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Control & Coordination', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Heredity & Evolution', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'How do Organism Reproduce', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Life Process', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Management of Nature', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Our Environment', 7, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Acid Bases & Salts', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Carbon & Its Compounds', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Chemical Reactions & Equations', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Metals & Non Metals', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Periodic Clasification', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Chemistry';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='English';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Areas Related To Circles', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Arithmetic Progression', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Circles', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Constructions', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Coordinate Geometry', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Height & Distance', 7, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Introduction to Trigonometry', 8, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Pair of Linear Equation in Two Variables', 9, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Polynomials', 10, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Probability', 11, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Quadratic Equations', 12, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Real Numbers', 13, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Similar Triangles', 14, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Statistics', 15, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Surface Areas & Volumes', 16, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Mathematics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Electricity', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 2, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Human Eye & The Colourful World', 3, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Light Reflection & Refraction', 4, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Magnetic Effects of Current', 5, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'Sources of Energy', 6, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 10' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 11' AND sj.name='Biology';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 11' AND sj.name='Physics';
INSERT INTO tq_chapters (offeringId, name, sortOrder, isActive)
SELECT o.id, 'General', 1, 1 FROM tq_offerings o JOIN tq_classes c ON c.id=o.classId JOIN tq_subjects sj ON sj.id=o.subjectId JOIN tq_boards b ON b.id=o.boardId WHERE b.code='CBSE' AND c.name='Class 12' AND sj.name='Biology';
