
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Trash2, Calculator } from 'lucide-react';

interface PayrollItem {
  id: string;
  type: 'bonus' | 'deduction';
  name: string;
  amount: number;
  isPercentage: boolean;
}

interface PayrollSettingsProps {
  data: any;
  onChange: (data: any) => void;
}

export const PayrollSettings: React.FC<PayrollSettingsProps> = ({ data, onChange }) => {
  const [payPeriod, setPayPeriod] = useState(data.payPeriod || 'biweekly');
  const [payrollProvider, setPayrollProvider] = useState(data.payrollProvider || 'shiftmint');
  const [ficaTipCredit, setFicaTipCredit] = useState(data.ficaTipCredit || false);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>(data.payrollItems || []);

  const updateData = (updates: any) => {
    const newData = { ...data, ...updates };
    onChange(newData);
  };

  const addPayrollItem = (type: 'bonus' | 'deduction') => {
    const newItem: PayrollItem = {
      id: Date.now().toString(),
      type,
      name: `New ${type}`,
      amount: 0,
      isPercentage: false
    };
    const newItems = [...payrollItems, newItem];
    setPayrollItems(newItems);
    updateData({ payrollItems: newItems });
  };

  const removePayrollItem = (id: string) => {
    const newItems = payrollItems.filter(item => item.id !== id);
    setPayrollItems(newItems);
    updateData({ payrollItems: newItems });
  };

  const updatePayrollItem = (id: string, field: keyof PayrollItem, value: any) => {
    const newItems = payrollItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setPayrollItems(newItems);
    updateData({ payrollItems: newItems });
  };

  const bonuses = payrollItems.filter(item => item.type === 'bonus');
  const deductions = payrollItems.filter(item => item.type === 'deduction');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Payroll & Tax Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pay Period */}
          <div className="space-y-2">
            <Label htmlFor="pay-period">Pay Period</Label>
            <Select value={payPeriod} onValueChange={(value) => {
              setPayPeriod(value);
              updateData({ payPeriod: value });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select pay frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payroll Provider */}
          <div className="space-y-2">
            <Label htmlFor="payroll-provider">Payroll Provider</Label>
            <Select value={payrollProvider} onValueChange={(value) => {
              setPayrollProvider(value);
              updateData({ payrollProvider: value });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select payroll system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shiftmint">ShiftMint (Built-in)</SelectItem>
                <SelectItem value="quickbooks">QuickBooks</SelectItem>
                <SelectItem value="adp">ADP</SelectItem>
                <SelectItem value="gusto">Gusto</SelectItem>
                <SelectItem value="paychex">Paychex</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* FICA Tip Credit */}
          <div className="flex items-center space-x-2">
            <Switch
              id="fica-tip-credit"
              checked={ficaTipCredit}
              onCheckedChange={(checked) => {
                setFicaTipCredit(checked);
                updateData({ ficaTipCredit: checked });
              }}
            />
            <Label htmlFor="fica-tip-credit">Enable FICA tip credit calculation</Label>
          </div>
        </CardContent>
      </Card>

      {/* Bonuses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Bonuses
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPayrollItem('bonus')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Bonus
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bonuses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No bonuses configured</p>
          ) : (
            <div className="space-y-3">
              {bonuses.map((bonus) => (
                <div key={bonus.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Input
                    value={bonus.name}
                    onChange={(e) => updatePayrollItem(bonus.id, 'name', e.target.value)}
                    placeholder="Bonus name"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={bonus.amount}
                      onChange={(e) => updatePayrollItem(bonus.id, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-24"
                      min="0"
                      step="0.01"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updatePayrollItem(bonus.id, 'isPercentage', !bonus.isPercentage)}
                    >
                      <Badge variant={bonus.isPercentage ? "default" : "outline"}>
                        {bonus.isPercentage ? '%' : '$'}
                      </Badge>
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePayrollItem(bonus.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deductions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-600" />
              Deductions
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addPayrollItem('deduction')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Deduction
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deductions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No deductions configured</p>
          ) : (
            <div className="space-y-3">
              {deductions.map((deduction) => (
                <div key={deduction.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Input
                    value={deduction.name}
                    onChange={(e) => updatePayrollItem(deduction.id, 'name', e.target.value)}
                    placeholder="Deduction name"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={deduction.amount}
                      onChange={(e) => updatePayrollItem(deduction.id, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-24"
                      min="0"
                      step="0.01"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updatePayrollItem(deduction.id, 'isPercentage', !deduction.isPercentage)}
                    >
                      <Badge variant={deduction.isPercentage ? "default" : "outline"}>
                        {deduction.isPercentage ? '%' : '$'}
                      </Badge>
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePayrollItem(deduction.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
