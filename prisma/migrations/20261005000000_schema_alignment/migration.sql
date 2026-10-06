-- Additive changes preserve every existing shift value. A legacy runtime that
-- already added one of these columns fails without dropping or replacing shifts.
ALTER TABLE "shifts" ADD COLUMN "position" TEXT;
ALTER TABLE "shifts" ADD COLUMN "employeeType" TEXT;
ALTER TABLE "shifts" ADD COLUMN "stationNumber" TEXT;
ALTER TABLE "shifts" ADD COLUMN "hourlyRate" REAL NOT NULL DEFAULT 0;
ALTER TABLE "shifts" ADD COLUMN "regularWage" REAL NOT NULL DEFAULT 0;
ALTER TABLE "shifts" ADD COLUMN "overtimeWage" REAL NOT NULL DEFAULT 0;
ALTER TABLE "shifts" ADD COLUMN "totalWage" REAL NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "refresh_tokens_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payroll_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "regularHours" REAL NOT NULL DEFAULT 0,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "regularPay" REAL NOT NULL DEFAULT 0,
    "overtimePay" REAL NOT NULL DEFAULT 0,
    "grossPay" REAL NOT NULL DEFAULT 0,
    "totalTips" REAL NOT NULL DEFAULT 0,
    "totalTaxes" REAL NOT NULL DEFAULT 0,
    "netPay" REAL NOT NULL DEFAULT 0,
    "hoursWorked" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payroll_entries_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payroll_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payroll_entries" ("createdAt", "employeeId", "grossPay", "hoursWorked", "id", "netPay", "notes", "overtimeHours", "overtimePay", "payrollPeriodId", "regularHours", "regularPay", "totalTaxes", "totalTips", "updatedAt") SELECT "createdAt", "employeeId", "grossPay", "hoursWorked", "id", "netPay", "notes", "overtimeHours", "overtimePay", "payrollPeriodId", "regularHours", "regularPay", "totalTaxes", "totalTips", "updatedAt" FROM "payroll_entries";
DROP TABLE "payroll_entries";
ALTER TABLE "new_payroll_entries" RENAME TO "payroll_entries";
CREATE UNIQUE INDEX "payroll_entries_payrollPeriodId_employeeId_key" ON "payroll_entries"("payrollPeriodId", "employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenId_key" ON "refresh_tokens"("tokenId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenId_idx" ON "refresh_tokens"("tokenId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

