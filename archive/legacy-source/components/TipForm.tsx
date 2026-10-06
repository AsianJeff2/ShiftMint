
import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { createMinimalTip } from '@/lib/utils';
import { toast } from 'sonner';

interface TipFormData {
  amount: string;
  tipType: 'cash' | 'credit' | 'other';
  source: string;
  tableNumber: string;
  notes: string;
}

const TipForm: React.FC = () => {
  const { createTip, loadingTips } = useData();
  
  const [formData, setFormData] = useState<TipFormData>({
    amount: '',
    tipType: 'credit',
    source: 'manual',
    tableNumber: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const tipData = createMinimalTip({
        amount,
        tipType: formData.tipType as any,
        source: (formData.source || 'manual') as any,
        tableNumber: formData.tableNumber || undefined,
        notes: formData.notes || undefined,
      });

      await createTip(tipData);

      // Reset form
      setFormData({
        amount: '',
        tipType: 'credit',
        source: 'manual' as const,
        tableNumber: '',
        notes: '',
      });

      toast.success('Tip added successfully!');
    } catch (error: any) {
      console.error('Error creating tip:', error);
      const errorMessage = error?.userMessage || error?.message || 'Failed to add tip. Please try again.';
      toast.error(errorMessage);
    }
  };

  const handleInputChange = (field: keyof TipFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTipTypeChange = (value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      tipType: value as 'cash' | 'credit' | 'other'
    }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Add New Tip
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              required
            />
          </div>

          {/* Tip Type */}
          <div className="space-y-2">
            <Label htmlFor="tipType">Tip Type</Label>
            <Select value={formData.tipType} onValueChange={handleTipTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select tip type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit">Credit Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              type="text"
              placeholder="e.g., Table service, Delivery"
              value={formData.source}
              onChange={(e) => handleInputChange('source', e.target.value)}
            />
          </div>

          {/* Table Number */}
          <div className="space-y-2">
            <Label htmlFor="tableNumber">Table Number</Label>
            <Input
              id="tableNumber"
              type="text"
              placeholder="e.g., Table 5"
              value={formData.tableNumber}
              onChange={(e) => handleInputChange('tableNumber', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full"
            disabled={loadingTips || !formData.amount}
          >
            {loadingTips ? 'Adding...' : 'Add Tip'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TipForm;
