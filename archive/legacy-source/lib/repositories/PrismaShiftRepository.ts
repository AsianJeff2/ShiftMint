import type { PrismaClient, Shift } from '@prisma/client';
import { IShiftRepository, CreateShiftData, ShiftFilters } from './IShiftRepository';

/**
 * Prisma implementation of Shift Repository
 */
export class PrismaShiftRepository implements IShiftRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, businessId: string): Promise<Shift | null> {
    return this.prisma.shift.findFirst({
      where: {
        id,
        businessId,
      },
    });
  }

  async findAll(businessId: string): Promise<Shift[]> {
    return this.prisma.shift.findMany({
      where: { businessId },
      orderBy: { shiftDate: 'desc' },
    });
  }

  async findByEmployee(employeeId: string, businessId: string): Promise<Shift[]> {
    return this.prisma.shift.findMany({
      where: {
        employeeId,
        businessId,
      },
      orderBy: { shiftDate: 'desc' },
    });
  }

  async findByDateRange(startDate: string, endDate: string, businessId: string): Promise<Shift[]> {
    return this.prisma.shift.findMany({
      where: {
        businessId,
        shiftDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { shiftDate: 'asc' },
    });
  }

  async findWithFilters(filters: ShiftFilters, businessId: string): Promise<Shift[]> {
    const where: any = { businessId };

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.startDate || filters.endDate) {
      where.shiftDate = {};
      if (filters.startDate) {
        where.shiftDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.shiftDate.lte = filters.endDate;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.shift.findMany({
      where,
      orderBy: { shiftDate: 'desc' },
    });
  }

  async findActive(businessId: string): Promise<Shift[]> {
    return this.prisma.shift.findMany({
      where: {
        businessId,
        status: 'active',
        endTime: null,
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async calculateTotalHours(
    employeeId: string,
    startDate: string,
    endDate: string,
    businessId: string
  ): Promise<number> {
    const shifts = await this.prisma.shift.findMany({
      where: {
        employeeId,
        businessId,
        shiftDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'completed',
      },
    });

    return shifts.reduce((total: number, shift: Shift) => {
      // Use durationMin if available, otherwise calculate from startTime/endTime
      if (shift.durationMin) {
        return total + (shift.durationMin / 60);
      }
      if (shift.startTime && shift.endTime) {
        const hours =
          (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);
  }

  async create(data: CreateShiftData, businessId: string): Promise<Shift> {
    return this.prisma.shift.create({
      data: {
        ...data,
        businessId,
        status: data.status || 'active',
        totalSales: data.totalSales || 0,
      },
    });
  }

  async update(
    id: string,
    data: Partial<CreateShiftData>,
    businessId: string
  ): Promise<Shift> {
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Shift ${id} not found for business ${businessId}`);
    }

    return this.prisma.shift.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, businessId: string): Promise<void> {
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Shift ${id} not found for business ${businessId}`);
    }

    await this.prisma.shift.delete({
      where: { id },
    });
  }
}
