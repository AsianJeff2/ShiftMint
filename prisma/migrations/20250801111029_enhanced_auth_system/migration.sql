-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "location" TEXT;
ALTER TABLE "businesses" ADD COLUMN "posSystem" TEXT;
ALTER TABLE "businesses" ADD COLUMN "usageIntent" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "passwordHash" TEXT NOT NULL,
    "lastLoginAt" DATETIME,
    "preferredPayrollFreq" TEXT NOT NULL DEFAULT 'bi-weekly',
    "preferredTipStyle" TEXT NOT NULL DEFAULT 'hybrid',
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "acceptedPrivacy" BOOLEAN NOT NULL DEFAULT false,
    "analyticsConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "businessId" TEXT NOT NULL,
    CONSTRAINT "users_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_users" ("businessId", "createdAt", "email", "firstName", "id", "lastLoginAt", "lastName", "passwordHash", "role", "updatedAt") SELECT "businessId", "createdAt", "email", "firstName", "id", "lastLoginAt", "lastName", "passwordHash", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
