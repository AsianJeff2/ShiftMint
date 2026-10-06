import type { PrismaClient, TipEntry } from '@prisma/client';
import { ITipRepository, CreateTipData, TipFilters } from './ITipRepository';

/**
 * Prisma implementation of Tip Repository
 */
export class PrismaTipRepository implements ITipRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, businessId: string): Promise<TipEntry | null> {
    return this.prisma.tipEntry.findFirst({
      where: {
        id,
        businessId,
      },
    });
  }

  async findAll(businessId: string): Promise<TipEntry[]> {
    return this.prisma.tipEntry.findMany({
      where: { businessId },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByEmployee(employeeId: string, businessId: string): Promise<TipEntry[]> {
    return this.prisma.tipEntry.findMany({
      where: {
        employeeId,
        businessId,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date, businessId: string): Promise<TipEntry[]> {
    return this.prisma.tipEntry.findMany({
      where: {
        businessId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  async findWithFilters(filters: TipFilters, businessId: string): Promise<TipEntry[]> {
    const where: any = { businessId };

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }

    if (filters.tipType) {
      where.tipType = filters.tipType;
    }

    if (filters.isPooled !== undefined) {
      where.isPooled = filters.isPooled;
    }

    return this.prisma.tipEntry.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async findPooled(businessId: string): Promise<TipEntry[]> {
    return this.prisma.tipEntry.findMany({
      where: {
        businessId,
        isPooled: true,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async calculateTotalTips(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    businessId: string
  ): Promise<number> {
    const tips = await this.prisma.tipEntry.findMany({
      where: {
        employeeId,
        businessId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return tips.reduce((total: number, tip: TipEntry) => total + tip.amount, 0);
  }

  async calculateTipsByType(
    startDate: Date,
    endDate: Date,
    businessId: string
  ): Promise<Record<string, number>> {
    const tips = await this.prisma.tipEntry.findMany({
      where: {
        businessId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const tipsByType: Record<string, number> = {};

    tips.forEach((tip: TipEntry) => {
      const type = tip.tipType || 'other';
      tipsByType[type] = (tipsByType[type] || 0) + tip.amount;
    });

    return tipsByType;
  }

  async create(data: CreateTipData, businessId: string): Promise<TipEntry> {
    return this.prisma.tipEntry.create({
      data: {
        ...data,
        businessId,
        isPooled: data.isPooled || false,
      },
    });
  }

  async update(
    id: string,
    data: Partial<CreateTipData>,
    businessId: string
  ): Promise<TipEntry> {
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Tip ${id} not found for business ${businessId}`);
    }

    return this.prisma.tipEntry.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, businessId: string): Promise<void> {
    const existing = await this.findById(id, businessId);
    if (!existing) {
      throw new Error(`Tip ${id} not found for business ${businessId}`);
    }

    await this.prisma.tipEntry.delete({
      where: { id },
    });
  }
}
