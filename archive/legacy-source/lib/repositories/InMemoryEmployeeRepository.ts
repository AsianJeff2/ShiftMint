import type { Employee } from '@prisma/client';
import { IEmployeeRepository, CreateEmployeeData } from './IEmployeeRepository';

/**
 * In-Memory Employee Repository
 * Used for testing without database
 */
export class InMemoryEmployeeRepository implements IEmployeeRepository {
  private employees: Map<string, Employee> = new Map();
  private idCounter = 1;

  /**
   * Clear all data (useful for test cleanup)
   */
  clear(): void {
    this.employees.clear();
    this.idCounter = 1;
  }

  /**
   * Seed with test data
   */
  seed(employees: Employee[]): void {
    employees.forEach((emp: Employee) => {
      this.employees.set(emp.id, emp);
    });
  }

  async findById(id: string, businessId: string): Promise<Employee | null> {
    const employee = this.employees.get(id);
    if (employee && employee.businessId === businessId) {
      return employee;
    }
    return null;
  }

  async findAll(businessId: string): Promise<Employee[]> {
    return Array.from(this.employees.values())
      .filter((emp: Employee) => emp.businessId === businessId)
      .sort((a: Employee, b: Employee) => a.lastName.localeCompare(b.lastName));
  }

  async findByEmail(email: string, businessId: string): Promise<Employee | null> {
    return (
      Array.from(this.employees.values()).find(
        (emp: Employee) => emp.email === email && emp.businessId === businessId
      ) || null
    );
  }

  async findActive(businessId: string): Promise<Employee[]> {
    return Array.from(this.employees.values())
      .filter((emp: Employee) => emp.businessId === businessId && emp.status === 'active')
      .sort((a: Employee, b: Employee) => a.lastName.localeCompare(b.lastName));
  }

  async findTipEligible(businessId: string): Promise<Employee[]> {
    return Array.from(this.employees.values())
      .filter(
        (emp: Employee) =>
          emp.businessId === businessId && emp.tipEligible && emp.status === 'active'
      )
      .sort((a: Employee, b: Employee) => a.lastName.localeCompare(b.lastName));
  }

  async findByRole(role: string, businessId: string): Promise<Employee[]> {
    return Array.from(this.employees.values())
      .filter(
        (emp: Employee) =>
          emp.businessId === businessId && emp.role === role && emp.status === 'active'
      )
      .sort((a: Employee, b: Employee) => a.lastName.localeCompare(b.lastName));
  }

  async create(data: CreateEmployeeData, businessId: string): Promise<Employee> {
    const id = `emp_${this.idCounter++}`;
    const employee: Employee = {
      id,
      businessId,
      employeeNumber: `EMP${this.idCounter.toString().padStart(4, '0')}`,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      hourlyRate: data.hourlyRate,
      overtimeRate: data.overtimeRate || data.hourlyRate * 1.5,
      role: data.role,
      department: null,
      payType: 'hourly',
      status: data.status || 'active',
      startDate: data.startDate,
      terminationDate: data.terminationDate || null,
      taxExemptions: 0,
      address: null,
      emergencyContact: null,
      emergencyPhone: null,
      bankRoutingNumber: null,
      bankAccountNumber: null,
      tipEligible: data.tipEligible ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.employees.set(id, employee);
    return employee;
  }

  async update(
    id: string,
    data: Partial<CreateEmployeeData>,
    businessId: string
  ): Promise<Employee> {
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Employee ${id} not found for business ${businessId}`);
    }

    const updated: Employee = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    this.employees.set(id, updated);
    return updated;
  }

  async delete(id: string, businessId: string): Promise<void> {
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Employee ${id} not found for business ${businessId}`);
    }

    // Soft delete
    const updated: Employee = {
      ...existing,
      status: 'inactive',
      terminationDate: new Date(),
      updatedAt: new Date(),
    };

    this.employees.set(id, updated);
  }
}
