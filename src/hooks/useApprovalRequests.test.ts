import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApprovalRequests } from './useApprovalRequests';
import { mockApprovalApi } from '../services/mockApprovalApi';

describe('useApprovalRequests', () => {
  beforeEach(() => {
    mockApprovalApi.resetDemoData();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('loads initial requests and filters by search, status, and department', async () => {
    const { result } = renderHook(() => useApprovalRequests());

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('success');
    });
    expect(result.current.requests.length).toBeGreaterThanOrEqual(4);

    act(() => {
      result.current.setStatusFilter('UNIT_VERIFIED');
    });
    expect(
      result.current.filteredRequests.every((r) => r.status === 'UNIT_VERIFIED')
    ).toBe(true);

    act(() => {
      result.current.setDepartmentFilter('Engineering');
    });
    expect(
      result.current.filteredRequests.every(
        (r) => r.status === 'UNIT_VERIFIED' && r.department === 'Engineering'
      )
    ).toBe(true);

    act(() => {
      result.current.setSearchQuery('Telemetry');
    });
    expect(result.current.filteredRequests).toHaveLength(1);
    expect(result.current.filteredRequests[0].referenceCode).toBe('LOG-2026-0839');
  });

  it('initializes filters from URL query params and syncs updates', async () => {
    window.history.replaceState(
      null,
      '',
      '/?status=COMMAND_APPROVED&dept=Communications&q=Encrypted'
    );

    const { result } = renderHook(() => useApprovalRequests());

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('success');
    });

    expect(result.current.statusFilter).toBe('COMMAND_APPROVED');
    expect(result.current.departmentFilter).toBe('Communications');
    expect(result.current.searchQuery).toBe('Encrypted');
    expect(result.current.filteredRequests).toHaveLength(1);

    act(() => {
      result.current.setStatusFilter('ALL');
    });
    expect(window.location.search).not.toContain('status=');
  });

  it('rolls back optimistic update when simulated API error is enabled', async () => {
    const { result } = renderHook(() => useApprovalRequests());

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('success');
    });

    const target = result.current.requests.find(
      (r) => r.status === 'PENDING_REVIEW'
    )!;
    expect(target).toBeDefined();

    act(() => {
      result.current.setSimulateError(true);
    });

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.submitDecision({
          requestId: target.id,
          decision: 'VERIFY',
          remarks: 'Should roll back on 422 error.',
          actorRole: 'UNIT_REVIEWER',
          expectedVersion: target.version,
        });
      } catch (err) {
        caughtError = err;
      }
    });

    expect((caughtError as Error)?.message).toMatch(/422/);
    const afterRollback = result.current.requests.find((r) => r.id === target.id)!;
    expect(afterRollback.status).toBe('PENDING_REVIEW');
    expect(result.current.actionError).toContain('rolled back');
  });

  it('creates a new request and prepends it to the list', async () => {
    const { result } = renderHook(() => useApprovalRequests());

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('success');
    });

    const initialCount = result.current.requests.length;

    await act(async () => {
      await result.current.createRequest({
        title: 'Forward Relay Antenna Maintenance',
        department: 'Communications',
        priority: 'PRIORITY',
        estimatedBudgetMyr: 25000,
        justification: 'Scheduled preventative maintenance on sector 2 relay.',
      });
    });

    expect(result.current.requests).toHaveLength(initialCount + 1);
    expect(result.current.requests[0].title).toBe(
      'Forward Relay Antenna Maintenance'
    );
    expect(result.current.requests[0].status).toBe('PENDING_REVIEW');
  });

  it('silently refreshes JWT on 401 and retries the approval action', async () => {
    const { result } = renderHook(() => useApprovalRequests());

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('success');
    });

    const target = result.current.requests.find(
      (r) => r.status === 'PENDING_REVIEW'
    )!;
    mockApprovalApi.armTokenExpiry(false);

    await act(async () => {
      await result.current.submitDecision({
        requestId: target.id,
        decision: 'VERIFY',
        remarks: 'Verified after silent token refresh.',
        actorRole: 'UNIT_REVIEWER',
        expectedVersion: target.version,
      });
    });

    const updated = result.current.requests.find((r) => r.id === target.id)!;
    expect(updated.status).toBe('UNIT_VERIFIED');
    expect(result.current.sessionExpired).toBe(false);
  });

  it('sets sessionExpired when silent token refresh fails', async () => {
    const { result } = renderHook(() => useApprovalRequests());

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('success');
    });

    const target = result.current.requests.find(
      (r) => r.status === 'PENDING_REVIEW'
    )!;
    mockApprovalApi.armTokenExpiry(true);

    await act(async () => {
      try {
        await result.current.submitDecision({
          requestId: target.id,
          decision: 'VERIFY',
          remarks: 'Should trigger sessionExpired.',
          actorRole: 'UNIT_REVIEWER',
          expectedVersion: target.version,
        });
      } catch {
        // expected
      }
    });

    expect(result.current.sessionExpired).toBe(true);
  });

  it('undoes a decision within 10 seconds and appends a REVERTED audit log', async () => {
    const { result } = renderHook(() => useApprovalRequests());

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('success');
    });

    const target = result.current.requests.find(
      (r) => r.status === 'PENDING_REVIEW'
    )!;

    let undoId = '';
    await act(async () => {
      const res = await result.current.submitDecision({
        requestId: target.id,
        decision: 'VERIFY',
        remarks: 'Temporary verification to be undone.',
        actorRole: 'UNIT_REVIEWER',
        expectedVersion: target.version,
      });
      undoId = res.undoId;
    });

    expect(
      result.current.requests.find((r) => r.id === target.id)?.status
    ).toBe('UNIT_VERIFIED');

    await act(async () => {
      await result.current.undoDecision(undoId);
    });

    const reverted = result.current.requests.find((r) => r.id === target.id)!;
    expect(reverted.status).toBe('PENDING_REVIEW');
    expect(reverted.auditTrail.at(-1)?.action).toBe('REVERTED');
  });
});
