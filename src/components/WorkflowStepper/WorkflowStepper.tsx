import React from 'react';
import { Check, Clock, X } from 'lucide-react';
import type { WorkflowGate } from '../../domain/workflowMachine';
import './WorkflowStepper.scss';

export interface WorkflowStepperProps {
  /** Ordered list of approval gates to display. */
  gates: WorkflowGate[];
  /** Optional header label describing the workflow tier. */
  tierLabel?: string;
  /** Optional formatted budget or metadata label displayed on the right. */
  metaLabel?: string;
}

/**
 * Framework-agnostic workflow gate stepper styled strictly with SCSS and BEM.
 */
export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  gates,
  tierLabel = 'Workflow Path',
  metaLabel,
}) => {
  return (
    <section className="workflow-stepper" aria-label={tierLabel}>
      <div className="workflow-stepper__header">
        <span className="workflow-stepper__title">{tierLabel}</span>
        {metaLabel && <span className="workflow-stepper__budget">{metaLabel}</span>}
      </div>

      <ol className="workflow-stepper__list">
        {gates.map((gate, idx) => {
          const modifier =
            gate.state === 'completed'
              ? 'workflow-stepper__step--completed'
              : gate.state === 'current'
              ? 'workflow-stepper__step--active'
              : gate.state === 'rejected'
              ? 'workflow-stepper__step--rejected'
              : 'workflow-stepper__step--upcoming';

          const nextGate = gates[idx + 1];
          const connectorActive =
            nextGate &&
            (nextGate.state === 'completed' || nextGate.state === 'current');

          return (
            <React.Fragment key={gate.key}>
              <li
                className={`workflow-stepper__step ${modifier}`}
                aria-current={gate.state === 'current' ? 'step' : undefined}
              >
                <span className="workflow-stepper__badge" aria-hidden="true">
                  {gate.state === 'rejected' ? (
                    <X className="w-3.5 h-3.5" />
                  ) : gate.state === 'completed' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                </span>
                <span className="workflow-stepper__label">{gate.label}</span>
              </li>

              {idx < gates.length - 1 && (
                <li
                  aria-hidden="true"
                  className={`workflow-stepper__connector ${
                    connectorActive ? 'workflow-stepper__connector--active' : ''
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </section>
  );
};
