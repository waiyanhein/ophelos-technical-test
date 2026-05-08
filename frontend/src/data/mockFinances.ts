export type ProgressBucket = 'success' | 'warning' | 'danger'

export type MonthlyProgress = {
  month: string
  amount: number
  bucket: ProgressBucket
  isCurrent?: boolean
}

export type MoneyTone = 'success' | 'accent' | 'danger' | 'warning'
export type RowTone = 'success' | 'danger' | 'ink'

export type MoneyItem = {
  label: string
  amount: number
  signed?: boolean
  note?: string
}

export type MoneySection = {
  title: string
  tone: MoneyTone
  rowTone?: RowTone
  items: MoneyItem[]
  total?: { label: string; amount: number }
}

export type MoneyThisMonth = {
  sections: MoneySection[]
  outgoingsTotal: { label: string; amount: number }
}

export type SupportLink = {
  label: string
  href: string
}

export type FinancesSnapshot = {
  user: { firstName: string; email: string }
  period: string
  leftover: number
  status: { label: string; tone: 'warning' | 'success' | 'danger' }
  headline: string
  body: string
  insight: string
  money: MoneyThisMonth
  progress: MonthlyProgress[]
  progressNote: string
  support: { intro: string; links: SupportLink[] }
}

export const mockFinances: FinancesSnapshot = {
  user: { firstName: 'Sarah', email: 'sarah@example.com' },
  period: 'May 2025',
  leftover: 850,
  status: { label: 'Under pressure', tone: 'warning' },
  headline: 'You are making progress, but most of your income is already committed',
  body:
    'There is limited room if something unexpected comes up. The steps below show where you might be able to free up some breathing room.',
  insight:
    'Your loan repayment is £1,000 a month — a third of everything you earn. Based on what you have left over, you could afford to increase that repayment by around £85 a month without putting your essentials at risk. Even a small increase would help you clear it sooner. If it still feels unmanageable, a free debt adviser may be able to negotiate a lower amount on your behalf.',
  money: {
    sections: [
      {
        title: 'Income',
        tone: 'success',
        rowTone: 'success',
        items: [
          { label: 'Salary', amount: 2800, signed: true },
          { label: 'Other', amount: 300, signed: true },
        ],
        total: { label: 'Total income', amount: 3100 },
      },
      {
        title: 'Essential bills',
        tone: 'accent',
        items: [
          { label: 'Mortgage', amount: 500 },
          { label: 'Utilities', amount: 100 },
          { label: 'Food', amount: 500 },
          { label: 'Travel', amount: 150 },
        ],
      },
      {
        title: 'Debt repayment',
        tone: 'danger',
        rowTone: 'danger',
        items: [{ label: 'Loan repayment', amount: 1000 }],
      },
      {
        title: 'Discretionary',
        tone: 'warning',
        items: [
          {
            label: 'Netflix',
            amount: 15,
            note: 'You have 3 streaming subscriptions totalling £32 — could you cut one?',
          },
          { label: 'Spotify', amount: 9 },
          { label: 'Disney+', amount: 8 },
          {
            label: 'Deliveroo',
            amount: 150,
            note: 'Cutting this by half would save you £75 a month — £900 over the year',
          },
        ],
      },
    ],
    outgoingsTotal: { label: 'Total outgoings', amount: 2250 },
  },
  progress: [
    { month: 'May', amount: 850, bucket: 'success', isCurrent: true },
    { month: 'Apr', amount: 720, bucket: 'warning' },
    { month: 'Mar', amount: 580, bucket: 'warning' },
    { month: 'Feb', amount: 400, bucket: 'warning' },
    { month: 'Jan', amount: 300, bucket: 'danger' },
    { month: 'Dec', amount: 200, bucket: 'danger' },
  ],
  progressNote:
    'You have £650 more available each month than you did in December. That is real progress.',
  support: {
    intro:
      'If you are finding things difficult, a free debt adviser can make a real difference. They are on your side — not the lender’s.',
    links: [
      { label: 'StepChange — free debt advice', href: 'https://www.stepchange.org' },
      { label: 'Citizens Advice', href: 'https://www.citizensadvice.org.uk' },
    ],
  },
}
