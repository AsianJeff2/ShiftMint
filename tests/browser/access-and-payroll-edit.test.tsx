// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../setup';
import ProtectedRoute from '../../components/ProtectedRoute';
import { PayrollEditModal } from '../../components/payroll/PayrollEditModal';
import { Permission } from '../../lib/security/rbac';

const auth = vi.hoisted(() => ({ user: { role: 'staff' }, loading: false }));
vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => auth }));
afterEach(() => { cleanup(); auth.user.role = 'staff'; });

describe('page access and payroll estimate editing', () => {
  it('denies payroll access to staff and allows an owner', () => {
    const view = render(<ProtectedRoute permission={Permission.PAYROLL_VIEW}><p>Private payroll</p></ProtectedRoute>);
    expect(screen.queryByText('Private payroll')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('does not have access');
    auth.user.role = 'owner';
    view.rerender(<ProtectedRoute permission={Permission.PAYROLL_VIEW}><p>Private payroll</p></ProtectedRoute>);
    expect(screen.getByText('Private payroll')).toBeInTheDocument();
  });

  it('changes notes without offering manual payment or calculation status', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    render(<PayrollEditModal isOpen period={{ id: 'period', startDate: '2026-09-01', endDate: '2026-09-15', status: 'closed', notes: '' } as any} onClose={close} onUpdate={update} />);
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toBeDisabled();
    expect(screen.getByLabelText('End Date')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Reviewed estimate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Period' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('period', { notes: 'Reviewed estimate' }));
    expect(close).toHaveBeenCalledOnce();
  });
});
