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

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (typeof record.error === 'string') return record.error
  return null
}
