// The Rostr employee handbook: the documents Ask Rostr retrieves answers from (the "R" in RAG).
// Fictional demo content. One document is deliberately an OUTDATED version kept on file
// ("superseded"), because real knowledge bases are full of those, and an assistant must never
// answer from them.

export type HandbookSection = { heading: string; text: string };
export type HandbookDoc = {
  id: string;
  title: string;
  status: "current" | "superseded";
  effective: string;
  sections: HandbookSection[];
};

export const HANDBOOK: HandbookDoc[] = [
  {
    id: "overtime-policy",
    title: "Overtime policy",
    status: "current",
    effective: "2026-01-01",
    sections: [
      {
        heading: "Overtime pay",
        text: "Overtime is paid at 1.5 times your regular hourly rate for every hour worked over 40 hours in a pay week. The pay week runs Monday to Friday. Hours up to 40 are paid at your regular rate.",
      },
      {
        heading: "Approval",
        text: "Overtime must be approved by your manager before you work it. Unapproved overtime is still paid, but your manager will review it with you.",
      },
    ],
  },
  {
    id: "pto-policy-2026",
    title: "Vacation and time-off policy (2026)",
    status: "current",
    effective: "2026-01-01",
    sections: [
      {
        heading: "Vacation days",
        text: "Full-time employees receive their vacation days at the start of each calendar year. Your remaining balance is shown in Rostr under Time off.",
      },
      {
        heading: "Carry-over",
        text: "You can carry over up to 3 unused vacation days into the next year. Carried-over days must be used by March 31, or they expire.",
      },
    ],
  },
  {
    id: "pto-policy-2024",
    title: "Vacation and time-off policy (2024, superseded)",
    status: "superseded",
    effective: "2024-01-01",
    sections: [
      {
        heading: "Carry-over",
        text: "Unused vacation days carry over: you can carry over up to 5 unused vacation days into the next year, and carried-over vacation days never expire.",
      },
    ],
  },
  {
    id: "timeoff-requests",
    title: "Requesting time off",
    status: "current",
    effective: "2025-06-01",
    sections: [
      {
        heading: "How to request",
        text: "Submit time-off requests in Rostr at least 14 days in advance: that is the notice you need to give. Your manager approves or denies each request, and you are notified either way.",
      },
      {
        heading: "Short notice",
        text: "Requests with less than 14 days notice can still be approved, but only if your shifts can be covered.",
      },
    ],
  },
  {
    id: "shift-swaps",
    title: "Shift swaps",
    status: "current",
    effective: "2025-06-01",
    sections: [
      {
        heading: "Swapping a shift",
        text: "To swap a shift, both employees must agree and a manager must approve the swap in Rostr at least 24 hours before the shift starts. Swaps cannot create overlapping shifts or push anyone over 40 hours without overtime approval.",
      },
    ],
  },
  {
    id: "breaks",
    title: "Breaks",
    status: "current",
    effective: "2025-06-01",
    sections: [
      {
        heading: "Meal breaks",
        text: "If you work more than 5 hours in a shift, you get an unpaid 30-minute meal break. Breaks are not shown as separate shifts in the schedule.",
      },
    ],
  },
  {
    id: "timesheets",
    title: "Timesheets and pay day",
    status: "current",
    effective: "2025-06-01",
    sections: [
      {
        heading: "Timesheet lock",
        text: "Timesheets lock every Friday at 6 pm. Corrections after the lock need approval from payroll.",
      },
      {
        heading: "Pay day",
        text: "Pay day is the Wednesday after the pay week ends. Your pay stub is available in Rostr the same day.",
      },
    ],
  },
  {
    id: "sick-leave",
    title: "Sick leave",
    status: "current",
    effective: "2025-06-01",
    sections: [
      {
        heading: "Sick days",
        text: "Employees have 5 paid sick days per year. A doctor's note is needed after 3 sick days in a row.",
      },
    ],
  },
];
