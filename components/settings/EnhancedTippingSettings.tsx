import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmployeeRoleSchema } from '@/lib/types/api-dtos';
import { tipDistributionError, type TipDistributionRule, type TipDistributionSettings } from '@/lib/tip-distribution';

interface EnhancedTippingSettingsProps {
  data: TipDistributionSettings;
  onChange: (data: TipDistributionSettings) => void;
  disabled?: boolean;
}

export const EnhancedTippingSettings: React.FC<EnhancedTippingSettingsProps> = ({ data, onChange, disabled = false }) => {
  const update = (values: Partial<TipDistributionSettings>) => onChange({ ...data, ...values });
  const updateRule = (id: string, values: Partial<TipDistributionRule>) => update({ distributionRules: data.distributionRules.map(rule => rule.id === id ? { ...rule, ...values } : rule) });
  const roles = [...new Set([...EmployeeRoleSchema.options, ...data.distributionRules.flatMap(rule => rule.roles)])];
  const problem = tipDistributionError(data);
  return <Card>
    <CardHeader><CardTitle>Tip distribution rules</CardTitle><CardDescription>Configure the read-only distribution preview. Saving rules does not allocate tips, update payroll, or establish legal tip-pooling eligibility.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <label className="flex items-center gap-2"><input type="checkbox" checked={data.enableCashTips} onChange={event => update({ enableCashTips: event.target.checked })} />Include cash tips in the preview pool</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={data.requireMinimumHours} onChange={event => update({ requireMinimumHours: event.target.checked })} />Require minimum period hours</label>
        {data.requireMinimumHours && <div><Label htmlFor="tip-minimum-hours">Minimum period hours</Label><Input id="tip-minimum-hours" type="number" min="0" step="0.25" value={data.minimumHoursThreshold} onChange={event => update({ minimumHoursThreshold: Number(event.target.value) })} /></div>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={data.enableOvertimeBonus} onChange={event => update({ enableOvertimeBonus: event.target.checked })} />Weight overtime hours for hours-based groups</label>
        {data.enableOvertimeBonus && <div><Label htmlFor="tip-overtime-multiplier">Overtime hours multiplier</Label><Input id="tip-overtime-multiplier" type="number" min="1" max="10" step="0.1" value={data.overtimeBonusMultiplier} onChange={event => update({ overtimeBonusMultiplier: Number(event.target.value) })} /></div>}
        {data.distributionRules.map((rule, index) => <div key={rule.id} className="rounded-md border p-4 space-y-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={rule.enabled} onChange={event => updateRule(rule.id, { enabled: event.target.checked })} />Enable group {index + 1}</label>
          <div><Label htmlFor={'tip-group-name-' + rule.id}>Group {index + 1} name</Label><Input id={'tip-group-name-' + rule.id} value={rule.name} onChange={event => updateRule(rule.id, { name: event.target.value })} /></div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label htmlFor={'tip-percentage-' + rule.id}>Group {index + 1} percentage</Label><Input id={'tip-percentage-' + rule.id} type="number" min="0" max="100" step="0.01" value={rule.percentage} onChange={event => updateRule(rule.id, { percentage: Number(event.target.value) })} /></div>
            <div><Label htmlFor={'tip-group-minimum-' + rule.id}>Group {index + 1} minimum hours</Label><Input id={'tip-group-minimum-' + rule.id} type="number" min="0" step="0.25" value={rule.minimumHours ?? 0} onChange={event => updateRule(rule.id, { minimumHours: Number(event.target.value) })} /></div>
            <div><Label htmlFor={'tip-method-' + rule.id}>Group {index + 1} distribution</Label><select id={'tip-method-' + rule.id} className="h-10 w-full rounded-md border bg-background px-3" value={rule.distributionMethod} onChange={event => updateRule(rule.id, { distributionMethod: event.target.value as 'equal' | 'hours' })}><option value="hours">Hours worked</option><option value="equal">Equal shares</option></select></div>
          </div>
          <div className="flex flex-wrap gap-3">{roles.map(role => <label key={role} className="flex gap-1 items-center text-sm"><input aria-label={rule.name + ': ' + role} type="checkbox" checked={rule.roles.includes(role)} onChange={event => updateRule(rule.id, { roles: event.target.checked ? [...rule.roles, role] : rule.roles.filter(value => value !== role) })} />{role}</label>)}</div>
          <Button type="button" variant="outline" onClick={() => update({ distributionRules: data.distributionRules.filter(value => value.id !== rule.id) })}>Remove group {index + 1}</Button>
        </div>)}
        <Button type="button" variant="outline" onClick={() => update({ distributionRules: [...data.distributionRules, { id: crypto.randomUUID(), name: 'New group', roles: ['server'], percentage: 0, distributionMethod: 'hours', minimumHours: 0, enabled: false }] })}>Add distribution group</Button>
      </fieldset>
      <p className="text-sm">Enabled group percentages: {data.distributionRules.filter(rule => rule.enabled).reduce((sum, rule) => sum + rule.percentage, 0)}%</p>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <p className="text-sm text-muted-foreground">Each enabled group receives its configured percentage. Points, shift differentials and automatic POS imports are unavailable. Review eligible roles and local rules with your payroll provider.</p>
    </CardContent>
  </Card>;
};
