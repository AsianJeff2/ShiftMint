/**
 * Employee Transformer
 *
 * Handles conversion between Prisma Employee models and API DTOs
 *
 * Key transformations:
 * - Prisma: phone: string | null → DTO: phone?: string | undefined
 * - Prisma: Date fields → DTO: string date fields
 * - Prisma: role: string → DTO: role: specific union type
 * - Field-level encryption for sensitive data (bank info, PII)
 */

import type { Employee } from '@prisma/client';
import type { CreateEmployeeRequest, UpdateEmployeeRequest } from '@/lib/types/api-dtos';
import { encryptedField } from '@/lib/security/encryption';

/**
 * Employee DTO for frontend use
 * Matches the shape expected by UI components
 */
export interface EmployeeDTO {
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

/**
 * Convert Prisma Employee to DTO for frontend consumption
 *
 * Handles:
 * - null → undefined conversion
 * - Date → ISO string conversion
 *
 * @param employee - Prisma Employee model
 * @returns EmployeeDTO for frontend use
 */
export function toEmployeeDTO(employee: Employee): EmployeeDTO {
  return {
    id: employee.id,
    businessId: employee.businessId,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? undefined,
    hourlyRate: employee.hourlyRate,
    role: employee.role,
    department: employee.department ?? undefined,
    startDate: employee.startDate instanceof Date
      ? employee.startDate.toISOString().split('T')[0]
      : employee.startDate,
    terminationDate: employee.terminationDate
      ? (employee.terminationDate instanceof Date
          ? employee.terminationDate.toISOString().split('T')[0]
          : employee.terminationDate)
      : undefined,
    status: employee.status as 'active' | 'inactive' | 'terminated',
    tipEligible: employee.tipEligible,
    payType: employee.payType as 'hourly' | 'salary',
    overtimeRate: employee.overtimeRate ?? undefined,
    // Decrypt sensitive fields from database
    address: encryptedField.fromDatabase(employee.address),
    emergencyContact: encryptedField.fromDatabase(employee.emergencyContact),
    emergencyPhone: encryptedField.fromDatabase(employee.emergencyPhone),
    taxExemptions: employee.taxExemptions,
    bankRoutingNumber: encryptedField.fromDatabase(employee.bankRoutingNumber),
    bankAccountNumber: encryptedField.fromDatabase(employee.bankAccountNumber),
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}

/**
 * Convert array of Prisma Employees to DTOs
 *
 * @param employees - Array of Prisma Employee models
 * @returns Array of EmployeeDTOs
 */
export function toEmployeeDTOs(employees: Employee[]): EmployeeDTO[] {
  return employees.map(toEmployeeDTO);
}

/**
 * Convert CreateEmployeeRequest DTO to Prisma create input
 *
 * Handles:
 * - undefined → null conversion (Prisma requires null)
 * - String dates → Date conversion (if needed)
 * - Type narrowing for enums
 *
 * @param dto - CreateEmployeeRequest from frontend
 * @returns Data ready for Prisma create
 */
export function fromCreateEmployeeDTO(dto: CreateEmployeeRequest): Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'businessId' | 'employeeNumber'> {
  return {
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    phone: dto.phone ?? null,
    hourlyRate: dto.hourlyRate,
    role: dto.role,
    department: dto.department ?? null,
    startDate: dto.startDate,
    terminationDate: dto.terminationDate ?? null,
    status: dto.status,
    tipEligible: dto.tipEligible,
    payType: dto.payType,
    overtimeRate: dto.overtimeRate ?? null,
    // Encrypt sensitive fields before storing in database
    address: encryptedField.toDatabase(dto.address),
    emergencyContact: encryptedField.toDatabase(dto.emergencyContact),
    emergencyPhone: encryptedField.toDatabase(dto.emergencyPhone),
    taxExemptions: dto.taxExemptions,
    bankRoutingNumber: encryptedField.toDatabase(dto.bankRoutingNumber),
    bankAccountNumber: encryptedField.toDatabase(dto.bankAccountNumber),
  } as any; // Cast needed due to Prisma's generated type complexity
}

/**
 * Convert UpdateEmployeeRequest DTO to Prisma update input
 *
 * Handles partial updates with null conversion
 *
 * @param dto - UpdateEmployeeRequest from frontend
 * @returns Data ready for Prisma update
 */
export function fromUpdateEmployeeDTO(dto: UpdateEmployeeRequest): Partial<Employee> {
  const update: any = {};

  if (dto.firstName !== undefined) update.firstName = dto.firstName;
  if (dto.lastName !== undefined) update.lastName = dto.lastName;
  if (dto.email !== undefined) update.email = dto.email;
  if (dto.phone !== undefined) update.phone = dto.phone ?? null;
  if (dto.hourlyRate !== undefined) update.hourlyRate = dto.hourlyRate;
  if (dto.role !== undefined) update.role = dto.role;
  if (dto.department !== undefined) update.department = dto.department ?? null;
  if (dto.startDate !== undefined) update.startDate = dto.startDate;
  if (dto.terminationDate !== undefined) update.terminationDate = dto.terminationDate ?? null;
  if (dto.status !== undefined) update.status = dto.status;
  if (dto.tipEligible !== undefined) update.tipEligible = dto.tipEligible;
  if (dto.payType !== undefined) update.payType = dto.payType;
  if (dto.overtimeRate !== undefined) update.overtimeRate = dto.overtimeRate ?? null;
  // Encrypt sensitive fields before updating in database
  if (dto.address !== undefined) update.address = encryptedField.toDatabase(dto.address);
  if (dto.emergencyContact !== undefined) update.emergencyContact = encryptedField.toDatabase(dto.emergencyContact);
  if (dto.emergencyPhone !== undefined) update.emergencyPhone = encryptedField.toDatabase(dto.emergencyPhone);
  if (dto.taxExemptions !== undefined) update.taxExemptions = dto.taxExemptions;
  if (dto.bankRoutingNumber !== undefined) update.bankRoutingNumber = encryptedField.toDatabase(dto.bankRoutingNumber);
  if (dto.bankAccountNumber !== undefined) update.bankAccountNumber = encryptedField.toDatabase(dto.bankAccountNumber);

  return update;
}

/**
 * Type guard to check if an object is a valid EmployeeDTO
 */
export function isEmployeeDTO(obj: any): obj is EmployeeDTO {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.firstName === 'string' &&
    typeof obj.lastName === 'string' &&
    typeof obj.email === 'string'
  );
}
