-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "ein" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "passwordHash" TEXT NOT NULL,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "businessId" TEXT NOT NULL,
    CONSTRAINT "users_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "hourlyRate" REAL NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "startDate" DATETIME NOT NULL,
    "terminationDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tipEligible" BOOLEAN NOT NULL DEFAULT true,
    "payType" TEXT NOT NULL DEFAULT 'hourly',
    "overtimeRate" REAL,
    "address" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "taxExemptions" INTEGER NOT NULL DEFAULT 0,
    "bankRoutingNumber" TEXT,
    "bankAccountNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "employees_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "business_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/New_York',
    "payPeriodStartDay" INTEGER NOT NULL DEFAULT 1,
    "payPeriodFrequency" TEXT NOT NULL DEFAULT 'bi-weekly',
    "tipPoolingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tipOutMethod" TEXT NOT NULL DEFAULT 'percentage',
    "defaultTipPercentage" REAL NOT NULL DEFAULT 18.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "business_configurations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT,
    "shiftDate" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationMin" INTEGER,
    "jobCode" TEXT NOT NULL DEFAULT 'server',
    "locationId" TEXT NOT NULL DEFAULT 'main',
    "status" TEXT NOT NULL DEFAULT 'active',
    "totalSales" REAL NOT NULL DEFAULT 0,
    "cashSales" REAL NOT NULL DEFAULT 0,
    "creditCardSales" REAL NOT NULL DEFAULT 0,
    "totalTips" REAL NOT NULL DEFAULT 0,
    "cashTips" REAL NOT NULL DEFAULT 0,
    "creditCardTips" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shifts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tip_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT,
    "shiftId" TEXT,
    "amount" REAL NOT NULL,
    "tipType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "tableNumber" TEXT,
    "notes" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" DATETIME,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tip_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tip_entries_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "totalTips" REAL NOT NULL DEFAULT 0,
    "totalSales" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payroll_periods_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payroll_entries" (
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
    CONSTRAINT "payroll_entries_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "punch_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT,
    "punchType" TEXT NOT NULL,
    "punchTime" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "punch_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "punch_events_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" TEXT,
    "newValues" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "audit_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analytics_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transmitted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "analytics_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_businessId_email_key" ON "employees"("businessId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_businessId_employeeNumber_key" ON "employees"("businessId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "business_configurations_businessId_key" ON "business_configurations"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_payrollPeriodId_employeeId_key" ON "payroll_entries"("payrollPeriodId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");
