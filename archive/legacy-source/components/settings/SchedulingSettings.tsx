
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, MapPin, Edit, Shield } from 'lucide-react';

interface SchedulingSettingsProps {
  data: any;
  onChange: (data: any) => void;
}

export const SchedulingSettings: React.FC<SchedulingSettingsProps> = ({ data, onChange }) => {
  const [autoClockout, setAutoClockout] = useState(data.autoClockout || false);
  const [autoClockoutMins, setAutoClockoutMins] = useState(data.autoClockoutMins || 30);
  const [geofencing, setGeofencing] = useState(data.geofencing || false);
  const [gracePeriodBefore, setGracePeriodBefore] = useState(data.gracePeriodBefore || 5);
  const [gracePeriodAfter, setGracePeriodAfter] = useState(data.gracePeriodAfter || 5);
  const [shiftEdits, setShiftEdits] = useState(data.shiftEdits || 'manager-only');

  const updateData = (updates: any) => {
    const newData = { ...data, ...updates };
    onChange(newData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Shift & Scheduling Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-clockout */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-clockout"
                checked={autoClockout}
                onCheckedChange={(checked) => {
                  setAutoClockout(checked);
                  updateData({ autoClockout: checked });
                }}
              />
              <Label htmlFor="auto-clockout">Auto-clockout after inactivity</Label>
            </div>
            {autoClockout && (
              <div className="ml-6 flex items-center gap-2">
                <Input
                  type="number"
                  value={autoClockoutMins}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setAutoClockoutMins(value);
                    updateData({ autoClockoutMins: value });
                  }}
                  className="w-20"
                  min="1"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
            )}
          </div>

          {/* Geofencing */}
          <div className="flex items-center space-x-2">
            <Switch
              id="geofencing"
              checked={geofencing}
              onCheckedChange={(checked) => {
                setGeofencing(checked);
                updateData({ geofencing: checked });
              }}
            />
            <Label htmlFor="geofencing" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Geofencing enforcement
            </Label>
          </div>

          {/* Grace Periods */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Grace Periods</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grace-before">Before shift starts</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="grace-before"
                    type="number"
                    value={gracePeriodBefore}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setGracePeriodBefore(value);
                      updateData({ gracePeriodBefore: value });
                    }}
                    className="w-20"
                    min="0"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grace-after">After shift ends</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="grace-after"
                    type="number"
                    value={gracePeriodAfter}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setGracePeriodAfter(value);
                      updateData({ gracePeriodAfter: value });
                    }}
                    className="w-20"
                    min="0"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shift Edits */}
          <div className="space-y-2">
            <Label htmlFor="shift-edits" className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Allow shift edits
            </Label>
            <Select value={shiftEdits} onValueChange={(value) => {
              setShiftEdits(value);
              updateData({ shiftEdits: value });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select edit permissions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes - All employees</SelectItem>
                <SelectItem value="manager-only">Manager Only</SelectItem>
                <SelectItem value="no">No - Locked after clock-out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
