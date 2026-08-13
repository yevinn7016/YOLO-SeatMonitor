const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/$/, '')

export function getApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const detail = typeof body === 'object' && body && 'detail' in body
      ? String((body as { detail: unknown }).detail)
      : `요청에 실패했습니다. (${response.status})`
    throw new ApiError(detail, response.status, body)
  }

  return body as T
}

export function getCameraFrameUrl(cacheKey = Date.now()) {
  return `${API_BASE_URL}/camera/frame.jpg?t=${cacheKey}`
}
