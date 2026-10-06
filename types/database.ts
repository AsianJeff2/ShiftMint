
// Frontend-only type definitions for ShiftMint
export interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  hire_date: string;
  hourly_wage: number;
  overtime_rate?: number;
  status: 'active' | 'inactive';
  business_id: string;
  bank_account_number?: string;
  routing_number?: string;
  pay_frequency?: string;
  tax_exemptions?: number;
  tax_filing_status?: string;
  termination_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessConfiguration {
  id: string;
  business_id: string;
  business_name: string;
  address?: any;
  tax_settings?: any;
  payroll_settings?: any;
  tip_pooling_rules?: any;
  pos_integration?: any;
  created_at?: string;
  updated_at?: string;
}

export interface PayrollPeriod {
  id: string;
  business_id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross_pay?: number;
  total_net_pay?: number;
  total_taxes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PayrollEntry {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  regular_hours?: number;
  overtime_hours?: number;
  regular_pay?: number;
  overtime_pay?: number;
  gross_pay?: number;
  federal_tax?: number;
  state_tax?: number;
  fica_tax?: number;
  net_pay?: number;
  total_tips?: number;
  total_deductions?: number;
  created_at?: string;
  updated_at?: string;
}
