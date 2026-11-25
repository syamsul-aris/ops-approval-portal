import type { PersonnelRequest } from '../types/approval';

function escapeCsvCell(value: string): string {
  // Prefix potential spreadsheet formula characters to prevent CSV formula injection
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

/**
 * Generates and downloads a UTF-8 CSV report of the currently filtered requests
 * using a zero-dependency client-side Blob.
 */
export function exportRequestsToCsv(requests: PersonnelRequest[]): void {
  const headers = [
    'Reference Code',
    'Title',
    'Department',
    'Submitted By',
    'Submitted Date',
    'Priority',
    'Status',
    'Audit Entries',
    'Justification',
  ];

  const rows = requests.map((req) =>
    [
      req.referenceCode,
      req.title,
      req.department,
      req.submittedBy,
      req.submittedDate,
      req.priority,
      req.status,
      String(req.auditTrail.length),
      req.justification,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `ops-approval-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
