import { getToken } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type LoginResponse = {
  authToken: string
  user: { id: string; name: string; email: string }
}

export type ProgressPoint = {
  period: string
  progress: number
  disposable_income: number
  is_now: boolean
}

export type MoneyItem = {
  description: string
  amount: number
}

export type MoneySection = {
  sectionKey: string
  sectionLabel: string
  subtotal: number
  items: MoneyItem[]
}

export type MoneyGroup = {
  total: number
  sections: MoneySection[]
}

export type YourMoneyThisMonth = {
  income: MoneyGroup
  outgoing: MoneyGroup
}

export type Dashboard = {
  overTimeProgress: ProgressPoint[]
  yourMoneyThisMonth: YourMoneyThisMonth
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new ApiError('Network error — please try again.', 0)
  }

  if (response.ok) {
    return (await response.json());
  }

  const body = await response.json();

  const message =
    response.status === 401
      ? 'Invalid email or password.'
      : extractErrorMessage(body) ?? 'Login failed — please try again.'

  throw new ApiError(message, response.status)
}

export async function fetchDashboard(month?: string): Promise<Dashboard> {
  const token = getToken()
  if (!token) {
    throw new ApiError('Not authenticated.', 401)
  }

  const query = month ? `?month=${encodeURIComponent(month)}` : ''

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/financial/dashboard${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError('Network error — please try again.', 0)
  }

  if (response.ok) {
    return await response.json()
  }

  const body = await response.json().catch(() => null)
  const message = extractErrorMessage(body) ?? 'Failed to load dashboard data.'
  throw new ApiError(message, response.status)
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record: Record<string, unknown> = { ...body }
  if (typeof record.error === 'string') return record.error
  return null
}
