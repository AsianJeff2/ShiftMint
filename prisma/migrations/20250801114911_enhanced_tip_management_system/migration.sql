-- CreateTable
CREATE TABLE "tip_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipEntryId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldChanged" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "performedBy" TEXT,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "tip_audit_logs_tipEntryId_fkey" FOREIGN KEY ("tipEntryId") REFERENCES "tip_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tip_audit_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tip_pool_distributions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "distributionDate" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "distributionMethod" TEXT NOT NULL,
    "participants" JSONB NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tip_pool_distributions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "compliance_calculations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT,
    "calculationDate" DATETIME NOT NULL,
    "payPeriodStart" DATETIME NOT NULL,
    "payPeriodEnd" DATETIME NOT NULL,
    "regularHours" REAL NOT NULL DEFAULT 0,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "regularRate" REAL NOT NULL DEFAULT 0,
    "tipWageRate" REAL NOT NULL DEFAULT 0,
    "totalTips" REAL NOT NULL DEFAULT 0,
    "tipCreditsUsed" REAL NOT NULL DEFAULT 0,
    "wageShortfall" REAL NOT NULL DEFAULT 0,
    "meetsMinimumWage" BOOLEAN NOT NULL DEFAULT false,
    "requiresAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "adjustmentAmount" REAL NOT NULL DEFAULT 0,
    "monthlyTipTotal" REAL NOT NULL DEFAULT 0,
    "requiresIRSReporting" BOOLEAN NOT NULL DEFAULT false,
    "form4070Required" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedBy" TEXT,
    CONSTRAINT "compliance_calculations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tip_import_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successfulRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "importedBy" TEXT,
    "importType" TEXT NOT NULL,
    "mappingConfig" JSONB NOT NULL,
    "errorLog" JSONB,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "tip_import_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tip_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT,
    "shiftId" TEXT,
    "amount" REAL NOT NULL,
    "tipType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "tableNumber" TEXT,
    "serverName" TEXT,
    "posTransactionId" TEXT,
    "isPooled" BOOLEAN NOT NULL DEFAULT false,
    "poolDistributionId" TEXT,
    "taxableAmount" REAL,
    "notes" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" DATETIME,
    "complianceStatus" TEXT NOT NULL DEFAULT 'pending',
    "wageCreditUsed" REAL NOT NULL DEFAULT 0,
    "irsReportable" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastModifiedBy" TEXT,
    "originalAmount" REAL,
    "changeReason" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tip_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tip_entries_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tip_entries_poolDistributionId_fkey" FOREIGN KEY ("poolDistributionId") REFERENCES "tip_pool_distributions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tip_entries" ("amount", "businessId", "createdAt", "employeeId", "id", "notes", "processed", "processedAt", "shiftId", "source", "tableNumber", "timestamp", "tipType", "transactionId", "updatedAt") SELECT "amount", "businessId", "createdAt", "employeeId", "id", "notes", "processed", "processedAt", "shiftId", "source", "tableNumber", "timestamp", "tipType", "transactionId", "updatedAt" FROM "tip_entries";
DROP TABLE "tip_entries";
ALTER TABLE "new_tip_entries" RENAME TO "tip_entries";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
