
export interface Rule {
  id: string;
  name: string;
  type: 'time' | 'pattern' | 'compliance' | 'anomaly';
  condition: string;
  severity: 'error' | 'warning' | 'info';
  isActive: boolean;
  isLearning: boolean;
  confidence: number;
  triggers: number;
  accuracy: number;
  lastTriggered?: Date;
  adaptations: number;
  parameters: Record<string, any>;
}
