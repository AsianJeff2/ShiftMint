import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/** Payroll period dates are calendar markers, independent of the viewer's timezone. */
export function formatCalendarDate(date: Date | string): string {
  const marker = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return new Date(`${marker}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

// Helper function to create a complete TipEntry object with defaults
// Returns data ready for API submission with ISO string timestamp
export function createMinimalTip(tipData: {
  amount: number;
  tipType?: 'pos_pretax' | 'pos_posttax' | 'pos_pooled' | 'cash' | 'credit' | 'hourly' | 'table_server' | 'bulk' | 'other';
  source?: 'manual' | 'pos' | 'csv_import' | 'bulk_entry' | 'auto_hourly';
  notes?: string;
  tableNumber?: string;
  serverName?: string;
  employeeId?: string;
  shiftId?: string;
}) {
  return {
    amount: tipData.amount,
    tipType: tipData.tipType || 'credit',
    source: tipData.source || 'manual',
    timestamp: new Date().toISOString(), // ISO string for API
    tableNumber: tipData.tableNumber,
    serverName: tipData.serverName,
    isPooled: false,
    notes: tipData.notes || '',
    wageCreditUsed: 0,
    employeeId: tipData.employeeId,
    shiftId: tipData.shiftId,
  };
}

// Helper function to create a complete Shift object with defaults
export function createMinimalShift(shiftData: {
  startTime: string;
  endTime?: string;
  durationMin?: number;
  jobCode?: string;
  locationId?: string;
  status?: 'active' | 'completed' | 'pending_review';
  employeeId?: string;
}) {
  return {
    businessId: '', // Will be set by API
    shiftDate: new Date().toISOString().split('T')[0], // Today's date
    startTime: shiftData.startTime,
    endTime: shiftData.endTime,
    durationMin: shiftData.durationMin,
    jobCode: shiftData.jobCode || 'server',
    locationId: shiftData.locationId || 'main',
    status: shiftData.status || 'active',
    totalSales: 0,
    cashSales: 0,
    creditCardSales: 0,
    totalTips: 0,
    cashTips: 0,
    creditCardTips: 0,
    notes: '',
    employeeId: shiftData.employeeId || undefined,
  };
}
