import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalModal } from './ApprovalModal';
import { ApiError } from '../services/mockApprovalApi';
import type { PersonnelRequest } from '../types/approval';

const baseRequest: PersonnelRequest = {
  id: 'req-101',
  referenceCode: 'OPS-2026-0841',
  title: 'Field Deployment Clearance — Team Bravo',
  department: 'Operations',
  submittedBy: 'Lt. Amirul Hakim',
  submittedDate: '2026-11-25',
  createdAtIso: new Date().toISOString(),
  priority: 'CRITICAL',
  estimatedBudgetMyr: 85000,
  status: 'PENDING_REVIEW',
  version: 1,
  justification: 'Scheduled maritime communications exercise.',
  auditTrail: [],
};

describe('ApprovalModal', () => {
  it('shows read-only view for REQUESTER role', () => {
    render(
      <ApprovalModal
        request={baseRequest}
        currentRole="REQUESTER"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/Read-only view for current role\/status/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Proceed to Review/i })).not.toBeInTheDocument();
  });

  it('allows UNIT_REVIEWER to complete multi-step verify flow on PENDING_REVIEW', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ApprovalModal
        request={baseRequest}
        currentRole="UNIT_REVIEWER"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Proceed to Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Verify & Forward/i }));

    const textarea = screen.getByPlaceholderText(/Enter verification notes/i);
    fireEvent.change(textarea, { target: { value: 'Roster and clearance verified.' } });

    fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        requestId: 'req-101',
        decision: 'VERIFY',
        remarks: 'Roster and clearance verified.',
        actorRole: 'UNIT_REVIEWER',
        expectedVersion: 1,
        forceOverride: false,
      });
    });
  });

  it('shows Grant Security Clearance for SECURITY_OFFICER on 3-tier UNIT_VERIFIED requests', () => {
    render(
      <ApprovalModal
        request={{ ...baseRequest, status: 'UNIT_VERIFIED' }}
        currentRole="SECURITY_OFFICER"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Proceed to Review/i }));
    expect(
      screen.getByRole('button', { name: /Grant Security Clearance/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject Request/i })).toBeInTheDocument();
  });

  it('shows Final Approve option for COMMAND_APPROVER on SECURITY_CLEARED requests', () => {
    render(
      <ApprovalModal
        request={{ ...baseRequest, status: 'SECURITY_CLEARED' }}
        currentRole="COMMAND_APPROVER"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Proceed to Review/i }));
    expect(screen.getByRole('button', { name: /Final Approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject Request/i })).toBeInTheDocument();
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(
      <ApprovalModal
        request={baseRequest}
        currentRole="UNIT_REVIEWER"
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks unsafe HTML/script markup in remarks', () => {
    render(
      <ApprovalModal
        request={baseRequest}
        currentRole="UNIT_REVIEWER"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Proceed to Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Verify & Forward/i }));

    const textarea = screen.getByPlaceholderText(/Enter verification notes/i);
    fireEvent.change(textarea, {
      target: { value: '<script>alert("xss")</script> verified' },
    });

    expect(
      screen.getByText(/HTML tags, scripts, and inline event handlers are not permitted/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review Summary/i })).toBeDisabled();
  });

  it('renders 409 Diff & Resolve Conflict banner on version mismatch', async () => {
    const latest: PersonnelRequest = {
      ...baseRequest,
      version: 2,
      estimatedBudgetMyr: 90000,
    };
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, '409 Conflict: Record modified concurrently.', latest)
      );

    render(
      <ApprovalModal
        request={baseRequest}
        currentRole="UNIT_REVIEWER"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Proceed to Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Verify & Forward/i }));
    fireEvent.change(screen.getByPlaceholderText(/Enter verification notes/i), {
      target: { value: 'Verification notes for conflict test.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Review Summary/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Submit/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Concurrent Edit Conflict \(409\) — Diff & Resolve/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Reload Latest Version/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Force Override/i })).toBeInTheDocument();
  });
});
