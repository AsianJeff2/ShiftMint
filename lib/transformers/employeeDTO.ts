import type { Employee } from '@prisma/client';

export interface EmployeeDTO {
  id: string; businessId: string; employeeNumber: string; firstName: string; lastName: string;
  email: string; phone?: string; hourlyRate: number; role: string; department?: string;
  startDate: string; terminationDate?: string; status: 'active' | 'inactive' | 'terminated';
  tipEligible: boolean; payType: 'hourly' | 'salary'; overtimeRate?: number;
  address?: string; emergencyContact?: string; emergencyPhone?: string; taxExemptions: number;
  bankRoutingNumber?: string; bankAccountNumber?: string; createdAt: string; updatedAt: string;
}

type EmployeeWire = Omit<Employee, 'startDate' | 'terminationDate' | 'createdAt' | 'updatedAt' | 'bankRoutingNumber' | 'bankAccountNumber'> & {
  startDate: Date | string; terminationDate: Date | string | null; createdAt: Date | string; updatedAt: Date | string;
};
const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : value;

// The authenticated server owns field encryption and redacts bank details.
export function toEmployeeDTO(employee: EmployeeWire): EmployeeDTO {
  return {
    id: employee.id, businessId: employee.businessId, employeeNumber: employee.employeeNumber,
    firstName: employee.firstName, lastName: employee.lastName, email: employee.email,
    phone: employee.phone ?? undefined, hourlyRate: employee.hourlyRate, role: employee.role,
    department: employee.department ?? undefined, startDate: iso(employee.startDate).split('T')[0],
    terminationDate: employee.terminationDate ? iso(employee.terminationDate).split('T')[0] : undefined,
    status: employee.status as EmployeeDTO['status'], tipEligible: employee.tipEligible,
    payType: employee.payType as EmployeeDTO['payType'], overtimeRate: employee.overtimeRate ?? undefined,
    address: employee.address ?? undefined, emergencyContact: employee.emergencyContact ?? undefined,
    emergencyPhone: employee.emergencyPhone ?? undefined, taxExemptions: employee.taxExemptions,
    createdAt: iso(employee.createdAt), updatedAt: iso(employee.updatedAt),
  };
}

export const toEmployeeDTOs = (employees: EmployeeWire[]): EmployeeDTO[] => employees.map(toEmployeeDTO);
