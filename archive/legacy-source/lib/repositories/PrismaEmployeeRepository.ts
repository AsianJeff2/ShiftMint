import type { PrismaClient, Employee } from '@prisma/client';
import { IEmployeeRepository, CreateEmployeeData } from './IEmployeeRepository';

/**
 * Prisma implementation of Employee Repository
 * Handles all database operations for employees
 */
export class PrismaEmployeeRepository implements IEmployeeRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, businessId: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: {
        id,
        businessId,
      },
    });
  }

  async findAll(businessId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: { businessId },
      orderBy: { lastName: 'asc' },
    });
  }

  async findByEmail(email: string, businessId: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: {
        email,
        businessId,
      },
    });
  }

  async findActive(businessId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: {
        businessId,
        status: 'active',
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findTipEligible(businessId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: {
        businessId,
        tipEligible: true,
        status: 'active',
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findByRole(role: string, businessId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: {
        businessId,
        role,
        status: 'active',
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async create(data: CreateEmployeeData, businessId: string): Promise<Employee> {
    // Generate employee number if not provided
    const count = await this.prisma.employee.count({ where: { businessId } });
    const employeeNumber = `EMP${(count + 1).toString().padStart(4, '0')}`;

    return this.prisma.employee.create({
      data: {
        ...data,
        businessId,
        employeeNumber,
        status: data.status || 'active',
        tipEligible: data.tipEligible ?? true,
        overtimeRate: data.overtimeRate || data.hourlyRate * 1.5,
      },
    });
  }

  async update(
    id: string,
    data: Partial<CreateEmployeeData>,
    businessId: string
  ): Promise<Employee> {
    // Verify employee belongs to business
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Employee ${id} not found for business ${businessId}`);
    }

    return this.prisma.employee.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, businessId: string): Promise<void> {
    // Verify employee belongs to business
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Employee ${id} not found for business ${businessId}`);
    }

    // Soft delete - set status to inactive
    await this.prisma.employee.update({
      where: { id },
      data: {
        status: 'inactive',
        terminationDate: new Date(),
      },
    });
  }
}
