import { describe, it, expect } from 'vitest';
import {
  IllegalTransitionError,
  getWorkflowGates,
  requiresSecurityClearance,
  transitionRequestStatus,
} from './workflowMachine';

describe('workflowMachine', () => {
  it('requires 3-tier security clearance for CRITICAL priority or budget > RM 50,000', () => {
    expect(
      requiresSecurityClearance({ priority: 'CRITICAL', estimatedBudgetMyr: 10000 })
    ).toBe(true);
    expect(
      requiresSecurityClearance({ priority: 'ROUTINE', estimatedBudgetMyr: 50001 })
    ).toBe(true);
    expect(
      requiresSecurityClearance({ priority: 'PRIORITY', estimatedBudgetMyr: 50000 })
    ).toBe(false);
  });

  it('prevents COMMAND_APPROVER from approving a 3-tier request before SECURITY_CLEARED', () => {
    expect(() =>
      transitionRequestStatus(
        {
          status: 'UNIT_VERIFIED',
          priority: 'CRITICAL',
          estimatedBudgetMyr: 80000,
        },
        'APPROVE',
        'COMMAND_APPROVER'
      )
    ).toThrow(IllegalTransitionError);
  });

  it('transitions 3-tier request through UNIT_VERIFIED -> SECURITY_CLEARED -> COMMAND_APPROVED', () => {
    const afterUnit = transitionRequestStatus(
      { status: 'PENDING_REVIEW', priority: 'CRITICAL', estimatedBudgetMyr: 80000 },
      'VERIFY',
      'UNIT_REVIEWER'
    );
    expect(afterUnit).toBe('UNIT_VERIFIED');

    const afterSec = transitionRequestStatus(
      { status: afterUnit, priority: 'CRITICAL', estimatedBudgetMyr: 80000 },
      'CLEAR_SECURITY',
      'SECURITY_OFFICER'
    );
    expect(afterSec).toBe('SECURITY_CLEARED');

    const afterCmd = transitionRequestStatus(
      { status: afterSec, priority: 'CRITICAL', estimatedBudgetMyr: 80000 },
      'APPROVE',
      'COMMAND_APPROVER'
    );
    expect(afterCmd).toBe('COMMAND_APPROVED');
  });

  it('returns 4 gates for 3-tier and 3 gates for 2-tier requests', () => {
    const threeTierGates = getWorkflowGates({
      status: 'UNIT_VERIFIED',
      priority: 'PRIORITY',
      estimatedBudgetMyr: 65000,
    });
    expect(threeTierGates.map((g) => g.key)).toEqual([
      'SUBMITTED',
      'UNIT_VERIFIED',
      'SECURITY_CLEARED',
      'COMMAND_APPROVED',
    ]);

    const twoTierGates = getWorkflowGates({
      status: 'UNIT_VERIFIED',
      priority: 'ROUTINE',
      estimatedBudgetMyr: 15000,
    });
    expect(twoTierGates.map((g) => g.key)).toEqual([
      'SUBMITTED',
      'UNIT_VERIFIED',
      'COMMAND_APPROVED',
    ]);
  });
});
