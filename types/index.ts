
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'employee' | 'manager' | 'admin';
  businessId: string;
  hourlyWage?: number;
  isActive: boolean;
}

export interface Employee {
  id: string;
  businessId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  hourlyRate: number;
  role: string;
  department?: string;
  startDate: string;
  terminationDate?: string;
  status: 'active' | 'inactive' | 'terminated';
  tipEligible: boolean;
  payType: 'hourly' | 'salary';
  overtimeRate?: number;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  taxExemptions: number;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  address: string;
  tipPoolingRules: TipPoolingRule[];
  posIntegration?: string;
}

export interface Shift {
  id: string;
  employeeId?: string | null;  // Can be null for unassigned shifts
  businessId: string;
  shiftDate: string;
  startTime: string;
  endTime?: string | null;  // Can be null for open shifts
  durationMin?: number;
  jobCode: string;
  position?: string;
  employeeType?: string;
  stationNumber?: string;
  locationId: string;
  status: 'active' | 'completed' | 'pending_review' | 'break';
  // Wage information
  hourlyRate: number;
  regularWage: number;
  overtimeWage: number;
  totalWage: number;
  // Sales and tips
  totalSales: number;
  cashSales: number;
  creditCardSales: number;
  totalTips: number;
  cashTips: number;
  creditCardTips: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  tipEntries?: Tip[];
  clockIn?: Date;  // For backward compatibility
  clockOut?: Date; // For backward compatibility
  hoursWorked?: number; // For backward compatibility
  tips?: Tip[]; // For backward compatibility
}

export interface Tip {
  id: string;
  shiftId?: string;
  employeeId?: string;
  businessId: string;
  amount: number;
  tipType: 'pos_pretax' | 'pos_posttax' | 'pos_pooled' | 'cash' | 'credit' | 'hourly' | 'table_server' | 'bulk' | 'other';
  source: 'manual' | 'pos' | 'csv_import' | 'bulk_entry' | 'auto_hourly';
  timestamp: Date;
  tableNumber?: string;
  serverName?: string;
  posTransactionId?: string;
  isPooled: boolean;
  poolDistributionId?: string;
  taxableAmount?: number;
  notes?: string;
  processed: boolean;
  processedAt?: Date;
  complianceStatus: 'pending' | 'compliant' | 'flagged' | 'requires_adjustment';
  wageCreditUsed: number;
  irsReportable: boolean;
  version: number;
  lastModifiedBy?: string;
  originalAmount?: number;
  changeReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Alias for backward compatibility
export interface TipEntry extends Tip {}

export interface TipPoolingRule {
  id: string;
  name: string;
  type: 'percentage' | 'hours' | 'flat_rate' | 'table_based';
  allocation: {
    role: string;
    percentage?: number;
    flatAmount?: number;
  }[];
  isActive: boolean;
}

export interface PayrollPeriod {
  id: string;
  businessId: string;
  startDate: string; // Changed to string for compatibility
  endDate: string;   // Changed to string for compatibility
  status: 'draft' | 'processing' | 'completed' | 'open' | 'closed' | 'paid' | 'calculated';
  totalTips?: number;
  totalSales?: number;
  notes?: string;
  payrollEntries?: PayrollEntry[];
  createdAt: string;
  updatedAt: string;
  // Additional properties for UI
  payDate?: Date;
  grossPay?: number;
  tipAmount?: number;
  employeeCount?: number;
  description?: string;
}

export interface PayrollEntry {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  totalTips: number;
  totalTaxes: number;
  netPay: number;
  hoursWorked: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollEmployee {
  employeeId: string;
  totalHours: number;
  totalTips: number;
  grossPay: number;
  taxes: {
    federal: number;
    state: number;
    fica: number;
    ficaTipCredit: number;
  };
  netPay: number;
}
