import { getToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type LoginResponse = {
  authToken: string;
  user: { id: string; name: string; email: string };
};

export type ProgressPoint = {
  period: string;
  progress: number;
  disposable_income: number;
  is_now: boolean;
};

export type MoneyItem = {
  description: string;
  amount: number;
};

export type MoneySection = {
  sectionKey: string;
  sectionLabel: string;
  subtotal: number;
  items: MoneyItem[];
};

export type MoneyGroup = {
  total: number;
  sections: MoneySection[];
};

export type YourMoneyThisMonth = {
  income: MoneyGroup;
  outgoing: MoneyGroup;
};

export type FinancialHealthRating = 'red' | 'amber' | 'green';

export type FinancialHealthBadgeTone = 'success' | 'warning' | 'danger';

export type FinancialHealthStatus = {
  rating: FinancialHealthRating;
  income: number;
  essentialSpend: number;
  debtRepayments: number;
  discretionarySpend: number;
  surplusAfterEssentials: number;
  headroom: number;
  headroomRatio: number;
  disposableIncome: number;
  badgeLabel: string;
  badgeTone: FinancialHealthBadgeTone;
  headline: string;
  body: string;
};

export type DashboardResDto = {
  overTimeProgress: ProgressPoint[];
  yourMoneyThisMonth: YourMoneyThisMonth;
  financialHealthStatus: FinancialHealthStatus;
  recommendations: string[];
};

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError('Network error — please try again.', 0);
  }

  if (response.ok) {
    return await response.json();
  }

  const body = await response.json();

  const message =
    response.status === 401
      ? 'Invalid email or password.'
      : (extractErrorMessage(body) ?? 'Login failed — please try again.');

  throw new ApiError(message, response.status);
}

export async function fetchDashboard(month?: string, year?: string): Promise<DashboardResDto> {
  const token = getToken();
  if (!token) {
    throw new ApiError('Not authenticated.', 401);
  }

  const query =
    month && year ? `?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}` : '';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/financial/dashboard${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError('Network error — please try again.', 0);
  }

  if (response.ok) {
    return await response.json();
  }

  const body = await response.json().catch(() => null);
  const message = extractErrorMessage(body) ?? 'Failed to load dashboard data.';
  throw new ApiError(message, response.status);
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record: Record<string, unknown> = { ...body };
  if (typeof record.error === 'string') return record.error;
  return null;
}
