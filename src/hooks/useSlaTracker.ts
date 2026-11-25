import { useEffect, useState } from 'react';
import type { PersonnelRequest, PriorityLevel } from '../types/approval';
import { isTerminalStatus } from '../domain/workflowMachine';

export const SLA_HOURS_BY_PRIORITY: Record<PriorityLevel, number> = {
  CRITICAL: 4,
  PRIORITY: 24,
  ROUTINE: 72,
};

export type SlaHealth = 'ON_TRACK' | 'WARNING' | 'BREACHED' | 'COMPLETED';

export interface SlaSnapshot {
  health: SlaHealth;
  remainingMs: number;
  percentRemaining: number;
  label: string;
}

export function formatDurationShort(ms: number): string {
  const absSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function computeSlaSnapshot(
  request: Pick<
    PersonnelRequest,
    'priority' | 'status' | 'createdAtIso' | 'resolvedAtIso'
  >,
  nowMs: number
): SlaSnapshot {
  const totalMs = SLA_HOURS_BY_PRIORITY[request.priority] * 3600 * 1000;
  const createdMs = new Date(request.createdAtIso).getTime();

  if (isTerminalStatus(request.status)) {
    const endMs = request.resolvedAtIso
      ? new Date(request.resolvedAtIso).getTime()
      : nowMs;
    const elapsedMs = Math.max(0, endMs - createdMs);
    return {
      health: 'COMPLETED',
      remainingMs: totalMs - elapsedMs,
      percentRemaining: 100,
      label: `Done in ${formatDurationShort(elapsedMs)}`,
    };
  }

  const deadlineMs = createdMs + totalMs;
  const remainingMs = deadlineMs - nowMs;
  const percentRemaining = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  if (remainingMs <= 0) {
    return {
      health: 'BREACHED',
      remainingMs,
      percentRemaining: 0,
      label: `-${formatDurationShort(remainingMs)}`,
    };
  }

  if (percentRemaining < 25) {
    return {
      health: 'WARNING',
      remainingMs,
      percentRemaining,
      label: `${formatDurationShort(remainingMs)} left`,
    };
  }

  return {
    health: 'ON_TRACK',
    remainingMs,
    percentRemaining,
    label: `${formatDurationShort(remainingMs)} left`,
  };
}

/**
 * Ticks every second so active SLA countdown badges update in real time.
 */
export function useSlaClock(): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return nowMs;
}
