const SPRINGFIELD = 'springfield.gov';

export type Turn =
  | { role: 'user'; text: string }
  | { role: 'agent'; text: string; source?: string };

export type Conversation = {
  turns: Turn[];
};

function getNextWeekday(day: number): Date {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  const daysUntil = (day - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntil);
  return result;
}

function getLastWeekday(day: number): Date {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  const daysSince = (result.getDay() - day + 7) % 7 || 7;
  result.setDate(result.getDate() - daysSince);
  return result;
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getNextTaxDueDate(): Date {
  const now = new Date();
  let year = now.getFullYear();
  let due = new Date(year, 10, 15);
  if (due <= now) {
    due = new Date(year + 1, 10, 15);
  }
  return due;
}

export function buildDemoConversations(): Conversation[] {
  const nextCouncil = getNextWeekday(3);
  const lastCouncil = getLastWeekday(3);
  const taxDue = getNextTaxDueDate();
  const nextCouncilLabel = formatLongDate(nextCouncil);
  const lastCouncilLabel = formatLongDate(lastCouncil);
  const taxDueLabel = formatLongDate(taxDue);

  return [
    {
      turns: [
        {
          role: 'user',
          text: 'When is the next city council meeting?',
        },
        {
          role: 'agent',
          text: `The next City Council meeting is ${nextCouncilLabel} at 7:00 PM in Council Chambers, 123 Main Street.`,
          source: `${SPRINGFIELD}/council/meetings`,
        },
        {
          role: 'user',
          text: 'Can I read the minutes from the last meeting?',
        },
        {
          role: 'agent',
          text: `Yes — approved minutes from the ${lastCouncilLabel} meeting are posted on the city website.`,
          source: `${SPRINGFIELD}/council/minutes`,
        },
      ],
    },
    {
      turns: [
        {
          role: 'user',
          text: 'How do I apply for a building permit?',
        },
        {
          role: 'agent',
          text: 'You can submit a permit application online or in person at the Planning Department. Most residential projects are reviewed within 10 business days.',
          source: `${SPRINGFIELD}/permits/building`,
        },
        {
          role: 'user',
          text: 'Do I need plans for a deck?',
        },
        {
          role: 'agent',
          text: 'Yes — structural plans are required for any deck over 30 inches above grade. You can upload them with your online application.',
          source: `${SPRINGFIELD}/permits/deck-requirements`,
        },
      ],
    },
    {
      turns: [
        {
          role: 'user',
          text: 'When is the deadline to pay property taxes?',
        },
        {
          role: 'agent',
          text: `The next property tax installment is due ${taxDueLabel}. You can pay online, by mail, or in person at the Treasurer's office.`,
          source: `${SPRINGFIELD}/treasurer/property-tax`,
        },
        {
          role: 'user',
          text: 'Is there a late fee if I miss the deadline?',
        },
        {
          role: 'agent',
          text: 'A 2% penalty applies after the due date, with additional interest accruing each month until the balance is paid.',
          source: `${SPRINGFIELD}/treasurer/penalties`,
        },
      ],
    },
  ];
}
