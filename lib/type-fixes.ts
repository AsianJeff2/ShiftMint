// Temporary type fixes for UI components
// These will be addressed in future component library updates

export interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  [key: string]: any;
}

export interface ChartLegendProps {
  payload?: any[];
  verticalAlign?: string;
  [key: string]: any;
}