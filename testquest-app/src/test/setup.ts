/**
 * Global test setup.
 *
 * Importing the Prisma mock here registers the `vi.mock` hoists for `@/lib/db`
 * and `@/lib/auth` across every test file, so individual tests only import the
 * mock when they need to stub a specific query.
 *
 * A guard also asserts that no test can reach a live database: DATABASE_URL is
 * blanked, so a query that slipped past the mock fails loudly instead of
 * quietly talking to Hostinger.
 */
import "./prisma-mock";

process.env.DATABASE_URL = "";
process.env.JWT_SECRET = "test-secret-not-used-for-anything-real";
