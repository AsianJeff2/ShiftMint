import type { PrismaClient, PayrollPeriod, PayrollEntry } from '@prisma/client';
import {
  IPayrollRepository,
  CreatePayrollPeriodData,
  CreatePayrollEntryData,
  PayrollPeriodWithEntries,
} from './IPayrollRepository';

/**
 * Prisma implementation of Payroll Repository
 */
export class PrismaPayrollRepository implements IPayrollRepository {
  constructor(private prisma: PrismaClient) {}

  // Payroll Period Methods

  async findPeriodById(id: string, businessId: string): Promise<PayrollPeriod | null> {
    return this.prisma.payrollPeriod.findFirst({
      where: {
        id,
        businessId,
      },
    });
  }

  async findAllPeriods(businessId: string): Promise<PayrollPeriod[]> {
    return this.prisma.payrollPeriod.findMany({
      where: { businessId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findPeriodWithEntries(
    id: string,
    businessId: string
  ): Promise<PayrollPeriodWithEntries | null> {
    return this.prisma.payrollPeriod.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
        payrollEntries: true,
      },
    }) as Promise<PayrollPeriodWithEntries | null>;
  }

  async findPeriodsByStatus(status: string, businessId: string): Promise<PayrollPeriod[]> {
    return this.prisma.payrollPeriod.findMany({
      where: {
        businessId,
        status,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createPeriod(data: CreatePayrollPeriodData, businessId: string): Promise<PayrollPeriod> {
    return this.prisma.payrollPeriod.create({
      data: {
        ...data,
        businessId,
        status: data.status || 'draft',
        totalTips: data.totalTips || 0,
        totalSales: data.totalSales || 0,
      },
    });
  }

  async updatePeriod(
    id: string,
    data: Partial<CreatePayrollPeriodData>,
    businessId: string
  ): Promise<PayrollPeriod> {
    const existing = await this.findPeriodById(id, businessId);
    if (!existing) {
      throw new Error(`Payroll period ${id} not found for business ${businessId}`);
    }

    return this.prisma.payrollPeriod.update({
      where: { id },
      data,
    });
  }

  async deletePeriod(id: string, businessId: string): Promise<void> {
    const existing = await this.findPeriodById(id, businessId);
    if (!existing) {
      throw new Error(`Payroll period ${id} not found for business ${businessId}`);
    }

    // Delete all entries first
    await this.prisma.payrollEntry.deleteMany({
      where: { payrollPeriodId: id },
    });

    // Delete the period
    await this.prisma.payrollPeriod.delete({
      where: { id },
    });
  }

  // Payroll Entry Methods

  async findEntriesByPeriod(periodId: string, businessId: string): Promise<PayrollEntry[]> {
    // Verify period belongs to business
    const period = await this.findPeriodById(periodId, businessId);
    if (!period) {
      throw new Error(`Payroll period ${periodId} not found for business ${businessId}`);
    }

    return this.prisma.payrollEntry.findMany({
      where: { payrollPeriodId: periodId },
      orderBy: { employeeId: 'asc' },
    });
  }

  async findEntriesByEmployee(employeeId: string, businessId: string): Promise<PayrollEntry[]> {
    // Get all periods for this business
    const periods = await this.findAllPeriods(businessId);
    const periodIds = periods.map((p: PayrollPeriod) => p.id);

    return this.prisma.payrollEntry.findMany({
      where: {
        employeeId,
        payrollPeriodId: { in: periodIds },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEntry(data: CreatePayrollEntryData, businessId: string): Promise<PayrollEntry> {
    // Verify period belongs to business
    const period = await this.findPeriodById(data.payrollPeriodId, businessId);
    if (!period) {
      throw new Error(
        `Payroll period ${data.payrollPeriodId} not found for business ${businessId}`
      );
    }

    return this.prisma.payrollEntry.create({
      data: {
        payrollPeriodId: data.payrollPeriodId,
        employeeId: data.employeeId,
        regularHours: data.regularHours,
        overtimeHours: data.overtimeHours,
        regularPay: data.regularPay,
        overtimePay: data.overtimePay,
        grossPay: data.grossPay,
        totalTips: data.totalTips,
        totalTaxes: data.totalTaxes,
        netPay: data.netPay,
      },
    });
  }

  async updateEntry(
    id: string,
    data: Partial<CreatePayrollEntryData>,
    businessId: string
  ): Promise<PayrollEntry> {
    // Verify entry exists and belongs to business
    const existing = await this.prisma.payrollEntry.findUnique({
      where: { id },
      include: { payrollPeriod: true },
    });

    if (!existing || existing.payrollPeriod.businessId !== businessId) {
      throw new Error(`Payroll entry ${id} not found for business ${businessId}`);
    }

    return this.prisma.payrollEntry.update({
      where: { id },
      data,
    });
  }

  async deleteEntry(id: string, businessId: string): Promise<void> {
    // Verify entry exists and belongs to business
    const existing = await this.prisma.payrollEntry.findUnique({
      where: { id },
      include: { payrollPeriod: true },
    });

    if (!existing || existing.payrollPeriod.businessId !== businessId) {
      throw new Error(`Payroll entry ${id} not found for business ${businessId}`);
    }

    await this.prisma.payrollEntry.delete({
      where: { id },
    });
  }
}
