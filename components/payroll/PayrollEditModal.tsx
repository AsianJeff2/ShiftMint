import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { PayrollPeriodDTOWithEntries } from '@/types/extended';

interface PayrollEditModalProps {
  period: PayrollPeriodDTOWithEntries | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (periodId: string, data: {
    startDate?: string;
    endDate?: string;
    notes?: string;
  }) => Promise<void>;
}

export const PayrollEditModal: React.FC<PayrollEditModalProps> = ({
  period,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (period) {
      const startDate = typeof period.startDate === 'object' && period.startDate !== null
        ? (period.startDate as Date).toISOString().split('T')[0]
        : new Date(period.startDate).toISOString().split('T')[0];
      
      const endDate = typeof period.endDate === 'object' && period.endDate !== null
        ? (period.endDate as Date).toISOString().split('T')[0]
        : new Date(period.endDate).toISOString().split('T')[0];

      setFormData({
        startDate,
        endDate,
        notes: period.notes || '',
      });
    }
  }, [period]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!period) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Only send changed fields
      const updates: { startDate?: string; endDate?: string; notes?: string } = {};
      
      const originalStartDate = typeof period.startDate === 'object' && period.startDate !== null
        ? (period.startDate as Date).toISOString().split('T')[0]
        : new Date(period.startDate).toISOString().split('T')[0];
      
      const originalEndDate = typeof period.endDate === 'object' && period.endDate !== null
        ? (period.endDate as Date).toISOString().split('T')[0]
        : new Date(period.endDate).toISOString().split('T')[0];

      if (formData.startDate !== originalStartDate) {
        updates.startDate = formData.startDate;
      }
      
      if (formData.endDate !== originalEndDate) {
        updates.endDate = formData.endDate;
      }
      
      if (formData.notes !== (period.notes || '')) {
        updates.notes = formData.notes;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await onUpdate(period.id, updates);
        onClose();
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('Error updating payroll period:', err);
      setError(err.userMessage || err.message || 'Failed to update payroll period');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  if (!period) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Payroll Period</DialogTitle>
            <DialogDescription>
              Update the details of this payroll period. Changes to dates will be validated for overlaps.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  disabled={period.status !== 'open'}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  disabled={period.status !== 'open'}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes about this payroll period"
                rows={3}
              />
            </div>

            {period.status !== 'open' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Reopen this period before changing its dates. Calculation determines its status; payment finalization requires a verified payroll provider.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Period'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
