# Operational Workflow & Approval Portal

A sanitized architectural demonstration of a role-based operational approval portal built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Vite**. It models multi-stage personnel/operations request approvals, optimistic UI updates with automatic rollback, URL-synchronized filtering, and accessible modal workflows.

## Folder Structure

```text
src/
├── components/
│   ├── ApprovalModal.tsx      # 3-step inspection, decision, and sign-off modal (Escape + focus trap)
│   ├── NewRequestModal.tsx    # Requester submission modal with client-side validation
│   ├── RequestTable.tsx       # Searchable, filterable, sortable, paginated table with batch actions
│   ├── RoleSwitcher.tsx       # Simulated RBAC persona switcher
│   └── ToastContainer.tsx     # Accessible live-region toast notifications
├── hooks/
│   ├── useApprovalRequests.ts # Domain state, URL query-param sync, optimistic updates & rollback
│   └── useModalA11y.ts        # Shared Escape-to-close and Tab focus-trap hook
├── services/
│   └── mockApprovalApi.ts     # Simulated async REST API with latency and 503/422 fault injection
├── types/
│   └── approval.ts            # Strict TypeScript domain models and payload contracts
└── App.tsx                    # Top-level composition, KPI summary, and toast/error orchestration
```

## State Machine & RBAC Transitions

Requests follow a strict finite state workflow:

```text
PENDING_REVIEW ──(UNIT_REVIEWER: VERIFY)──▶ VERIFIED ──(COMMAND_APPROVER: APPROVE)──▶ APPROVED
       │                                        │
       └──(UNIT_REVIEWER / COMMAND_APPROVER: REJECT)──▶ REJECTED
```

| Role | Permitted Actions |
| --- | --- |
| `REQUESTER` | Submit new requests (`PENDING_REVIEW`) and inspect status/audit trails (read-only on approvals). |
| `UNIT_REVIEWER` | Verify or reject `PENDING_REVIEW` requests (single or batch). |
| `COMMAND_APPROVER` | Final approve `VERIFIED` requests, or reject `PENDING_REVIEW` / `VERIFIED` requests (single or batch). |

## How the Mock Service Mirrors a Real REST + JWT Backend

- **Transport & Latency**: `mockApprovalApi` exposes async methods (`fetchRequests`, `createRequest`, `processApproval`, `processBatchApproval`) with simulated network delay, matching standard `GET /api/requests`, `POST /api/requests`, `PATCH /api/requests/:id/decision`, and `POST /api/requests/batch-decision` endpoints.
- **Fault Injection & Optimistic Rollback**: Toggling **Simulate API 503/422 Error** triggers HTTP-style failures (`503 Service Unavailable` / `422 Unprocessable Entity`). `useApprovalRequests` applies optimistic table updates immediately and rolls back to the pre-mutation snapshot if the promise rejects.
- **JWT / RBAC Boundary**: In production, `actorRole` and `actorName` are derived server-side from verified JWT claims rather than client-supplied payloads; the UI `RoleSwitcher` mirrors those claims to demonstrate role-gated controls and audit trail attribution.

## Scripts

```bash
npm run dev      # Start Vite development server
npm run build    # Type-check (tsc -b) and build production bundle
npm run lint     # Run ESLint across the repository
npm run test     # Run Vitest unit & component test suite
```
