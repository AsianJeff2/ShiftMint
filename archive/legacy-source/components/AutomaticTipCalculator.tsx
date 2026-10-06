
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, DollarSign, Percent } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { toast } from 'sonner';
import { createMinimalTip } from '@/lib/utils';

interface TipCalculation {
  totalSales: number;
  tipPercentage: number;
  calculatedTip: number;
}

interface AutomaticTipCalculatorProps {
  onTipsCalculated?: () => void;
}

export const AutomaticTipCalculator: React.FC<AutomaticTipCalculatorProps> = ({ 
  onTipsCalculated 
}) => {
  const { createTip } = useData();
  
  const [salesAmount, setSalesAmount] = useState('');
  const [tipPercentage, setTipPercentage] = useState('18');
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculation, setCalculation] = useState<TipCalculation | null>(null);

  const calculateTips = () => {
    const sales = parseFloat(salesAmount);
    const percentage = parseFloat(tipPercentage);

    if (isNaN(sales) || isNaN(percentage) || sales <= 0 || percentage <= 0) {
      toast.error('Please enter valid sales amount and tip percentage');
      return;
    }

    const calculatedTip = (sales * percentage) / 100;

    setCalculation({
      totalSales: sales,
      tipPercentage: percentage,
      calculatedTip
    });
  };

  const saveTip = async () => {
    if (!calculation) return;

    setIsCalculating(true);
    try {
      await createTip(createMinimalTip({
        amount: calculation.calculatedTip,
        tipType: 'credit',
        source: 'pos',
        notes: `Calculated from $${calculation.totalSales.toFixed(2)} sales at ${calculation.tipPercentage}%`,
      }));

      toast.success(`Tip of $${calculation.calculatedTip.toFixed(2)} recorded successfully`);
      
      // Reset form
      setSalesAmount('');
      setTipPercentage('18');
      setCalculation(null);
      onTipsCalculated?.();
    } catch (error) {
      console.error('Error saving calculated tip:', error);
      toast.error('Failed to save tip');
    } finally {
      setIsCalculating(false);
    }
  };

  const resetCalculation = () => {
    setCalculation(null);
    setSalesAmount('');
    setTipPercentage('18');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Automatic Tip Calculator
        </CardTitle>
        <CardDescription>
          Calculate tips from total sales and percentage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!calculation ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salesAmount">Total Sales Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="salesAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-10"
                    value={salesAmount}
                    onChange={(e) => setSalesAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipPercentage">Tip Percentage *</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="tipPercentage"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="18"
                    className="pl-10"
                    value={tipPercentage}
                    onChange={(e) => setTipPercentage(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Quick percentage buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Quick select:</span>
              {[15, 18, 20, 22, 25].map((percent) => (
                <Button
                  key={percent}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTipPercentage(percent.toString())}
                  className={tipPercentage === percent.toString() ? 'bg-blue-100' : ''}
                >
                  {percent}%
                </Button>
              ))}
            </div>

            <Button 
              type="button"
              onClick={calculateTips} 
              className="w-full"
              disabled={!salesAmount || !tipPercentage}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Tip
            </Button>
          </>
        ) : (
          <>
            {/* Calculation Results */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
              <h3 className="font-medium text-blue-900">Calculation Results</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total Sales:</span>
                  <span className="font-medium">{formatCurrency(calculation.totalSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tip Percentage:</span>
                  <span className="font-medium">{calculation.tipPercentage}%</span>
                </div>
                <div className="flex justify-between border-t pt-1 text-blue-900">
                  <span className="font-medium">Calculated Tip:</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(calculation.calculatedTip)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={saveTip}
                disabled={isCalculating}
                className="flex-1"
              >
                {isCalculating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Tip
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={resetCalculation}
                disabled={isCalculating}
              >
                Calculate Again
              </Button>
            </div>
          </>
        )}

        {/* Info section */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Tip:</strong> This calculator is useful for credit card tips where you know 
            the total sales amount and want to calculate the tip based on a percentage.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
