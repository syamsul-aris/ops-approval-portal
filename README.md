# Operational Workflow & Approval Portal

A sanitized architectural demonstration of a role-based operational approval portal built with **React 19**, **TypeScript**, **Redux Toolkit**, **SCSS (BEM)**, **Tailwind CSS v4**, and **Vite**.

## Folder Structure

```text
src/
├── components/
│   ├── ui/                        # Reusable generic UI primitives with JSDoc props
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── DataTable.tsx          # Generic DataTable<T> with keyboard row activation
│   │   └── EmptyState.tsx
│   ├── WorkflowStepper/           # Framework-agnostic SCSS + BEM stepper
│   │   ├── WorkflowStepper.tsx
│   │   └── WorkflowStepper.scss
│   ├── ActivityFeedDrawer.tsx     # Live session telemetry drawer
│   ├── ApprovalModal.tsx          # Slide-over approval drawer + 409 Diff & Resolve
│   ├── BottlenecksPanel.tsx       # Department SLA compliance & turnaround metrics
│   ├── CommandPalette.tsx         # Keyboard-driven Cmd+K / Ctrl+K palette
│   ├── ErrorBoundary.tsx          # Graceful render-crash fallback boundary
│   ├── NewRequestModal.tsx        # Requester submission modal with validation
│   ├── RequestTable.tsx           # Composes DataTable<T>, presets, chips, SLA & batching
│   ├── RoleSwitcher.tsx           # Accessible radiogroup RBAC persona switcher
│   └── ToastContainer.tsx         # Live-region toasts with 10s Undo action
├── domain/
│   └── workflowMachine.ts         # Explicit FSM & 2-tier / 3-tier conditional routing
├── hooks/
│   ├── useApprovalRequests.ts     # Typed Redux facade + URL query-param sync
│   ├── useModalA11y.ts            # Escape-to-close, Tab focus trap & focus restore
│   └── useSlaTracker.ts           # Real-time 1s SLA countdown & health classification
├── services/
│   └── mockApprovalApi.ts         # Async REST + JWT 401 refresh + 409 OCC version checks
├── store/
│   ├── approvalSlice.ts           # createSlice + createAsyncThunk + optimistic rollback
│   ├── hooks.ts                   # Typed useAppDispatch & useAppSelector hooks
│   └── store.ts                   # Redux Toolkit store factory
├── types/
│   └── approval.ts                # Strict TypeScript domain models
└── utils/
    ├── exportCsv.ts               # Zero-dependency Blob CSV export
    └── sanitize.ts                # XSS markup detection & input sanitization
```

## Architecture & JD Alignment

- **Redux Toolkit Global State (`src/store/`)**:
  - `approvalSlice.ts` centralizes `requests`, `currentRole`, filter/sort criteria, `fetchStatus`, `activityFeed`, and `undoStack` using `createSlice` and `createAsyncThunk` (`fetchRequestsThunk`, `createRequestThunk`, `submitDecisionThunk`, `submitBatchDecisionThunk`, `undoDecisionThunk`).
  - Optimistic updates (`applyOptimisticDecision`, `applyOptimisticBatch`) mutate state immediately and automatically roll back to the pre-mutation snapshot if an async thunk rejects (422/503), while `409 Conflict` rejections surface the server's latest record for side-by-side resolution.
  - Typed `useAppDispatch` and `useAppSelector` hooks in `src/store/hooks.ts` keep components strictly typed, while transient form/drawer state remains local to component hooks.
- **SCSS & BEM Methodology (`src/components/WorkflowStepper/`)**:
  - `WorkflowStepper` is decoupled from Tailwind and styled strictly with SCSS variables, `@mixin` helpers (`badge-state`, `respond-below`), and BEM classes (`.workflow-stepper`, `.workflow-stepper__step`, `.workflow-stepper__step--completed`, `.workflow-stepper__step--active`, `.workflow-stepper__connector`).
- **Reusable Generic UI Primitives (`src/components/ui/`)**:
  - `DataTable<T>`, `Button`, `Badge`, and `EmptyState` provide documented, strongly typed building blocks with consistent variants and JSDoc prop descriptions.
- **WCAG AA Accessibility**:
  - `ApprovalModal` and `NewRequestModal` implement `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Tab`/`Shift+Tab` focus trapping, `Escape` dismissal, and focus restoration via `useModalA11y`.
  - `RoleSwitcher` implements `role="radiogroup"` / `role="radio"` with `ArrowLeft`/`ArrowRight`/`Enter`/`Space` keyboard support; `DataTable<T>` supports `Tab`/`Enter`/`Space` row activation; `ToastContainer` and `App` provide `aria-live="polite"` status announcements.

## State Machine & RBAC Transitions

- **2-Tier Routing** (`ROUTINE` / `PRIORITY` with budget `<= RM 50,000`):
  `PENDING_REVIEW → UNIT_VERIFIED → COMMAND_APPROVED`
- **3-Tier Conditional Routing** (`CRITICAL` priority **or** budget `> RM 50,000`):
  `PENDING_REVIEW → UNIT_VERIFIED → SECURITY_CLEARED → COMMAND_APPROVED`

## Scripts

```bash
npm run dev      # Start Vite development server
npm run build    # Type-check (tsc -b) and build production bundle
npm run lint     # Run strict ESLint across the repository
npm test         # Run Vitest unit & component test suite
```
