// Type fixes for chart components
declare module '@/components/ui/chart' {
  export interface ChartTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
    [key: string]: any;
  }
}