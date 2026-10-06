export interface TipDistributionRule {
  id: string;
  name: string;
  roles: string[];
  percentage: number;
  distributionMethod: 'equal' | 'hours' | 'points';
  minimumHours?: number;
  enabled: boolean;
}
export interface TipDistributionSettings {
  tipCollectionMethod: 'pos' | 'manual' | 'hybrid';
  enableCashTips: boolean;
  tipDistributionMethod: 'percentage' | 'hours' | 'hybrid';
  enableKitchenTips: boolean;
  kitchenTipPercentage: number;
  distributionRules: TipDistributionRule[];
  requireMinimumHours: boolean;
  minimumHoursThreshold: number;
  enableTipPoints: boolean;
  tipPointMultipliers: Record<string, number>;
  enableOvertimeBonus: boolean;
  overtimeBonusMultiplier: number;
  enableShiftDifferentials: boolean;
  shiftDifferentials: Record<string, number>;
}

export function defaultTipDistributionSettings(): TipDistributionSettings {
  return {
    tipCollectionMethod: 'manual', enableCashTips: true, tipDistributionMethod: 'hours',
    enableKitchenTips: true, kitchenTipPercentage: 20,
    distributionRules: [
      { id: '1', name: 'Front of House', roles: ['server', 'bartender', 'host'], percentage: 80, distributionMethod: 'hours', minimumHours: 0, enabled: true },
      { id: '2', name: 'Back of House', roles: ['cook', 'dishwasher'], percentage: 20, distributionMethod: 'hours', minimumHours: 0, enabled: true },
    ],
    requireMinimumHours: false, minimumHoursThreshold: 4, enableTipPoints: false, tipPointMultipliers: {},
    enableOvertimeBonus: false, overtimeBonusMultiplier: 1.5, enableShiftDifferentials: false, shiftDifferentials: {},
  };
}

export function tipDistributionError(settings: TipDistributionSettings): string | null {
  const enabled = settings.distributionRules.filter(rule => rule.enabled);
  if (Math.abs(enabled.reduce((sum, rule) => sum + rule.percentage, 0) - 100) > 0.00001) return 'Enabled group percentages must total 100%.';
  if (settings.distributionRules.some(rule => !rule.name.trim() || !rule.roles.length || !Number.isFinite(rule.percentage) || rule.percentage < 0 || rule.percentage > 100 || !Number.isFinite(rule.minimumHours ?? 0) || (rule.minimumHours ?? 0) < 0)) return 'Each group needs a name, a role, a valid percentage and nonnegative minimum hours.';
  if (!Number.isFinite(settings.minimumHoursThreshold) || settings.minimumHoursThreshold < 0 || !Number.isFinite(settings.overtimeBonusMultiplier) || settings.overtimeBonusMultiplier < 1 || settings.overtimeBonusMultiplier > 10) return 'Enter valid minimum hours and an overtime multiplier between 1 and 10.';
  if (settings.enableTipPoints || settings.enableShiftDifferentials || settings.distributionRules.some(rule => rule.distributionMethod === 'points')) return 'Points and shift differentials are unavailable; use hours or equal distribution.';
  return null;
}
