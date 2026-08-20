-- Run this ONCE first: clears the previous partial question load (options cascade-delete).
DELETE FROM tq_questions WHERE isLegacy = 1;
