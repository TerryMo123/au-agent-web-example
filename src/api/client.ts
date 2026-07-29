import axios from 'axios'
import type {
  AuthUser,
  AdminSessionDetail,
  AdminSessionSummary,
  ChatResponse,
  DataPage,
  FilterOptions,
  LoginResponse,
  OverviewResponse,
  SessionDetail,
  SessionSummary,
} from '../types'

const TOKEN_KEY = 'au_agent_token'

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
}

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
})

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthToken()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`
      }
    }
    const detail = error?.response?.data?.detail
    if (typeof detail === 'string') {
      return Promise.reject(new Error(detail))
    }
    return Promise.reject(error)
  },
)

export async function login(username: string, password: string) {
  const { data } = await http.post<LoginResponse>('/auth/login', { username, password })
  return data
}

export async function fetchMe() {
  const { data } = await http.get<AuthUser>('/auth/me')
  return data
}

export async function listSessions(limit = 50) {
  const { data } = await http.get<{ items: SessionSummary[]; total: number }>(
    '/sessions',
    { params: { limit } },
  )
  return data
}

export async function createSession(title?: string) {
  const { data } = await http.post<SessionSummary>('/sessions', { title })
  return data
}

export async function getSession(sessionId: string) {
  const { data } = await http.get<SessionDetail>(`/sessions/${sessionId}`)
  return data
}

export async function deleteSession(sessionId: string) {
  await http.delete(`/sessions/${sessionId}`)
}

export async function listAdminSessions(limit = 50) {
  const { data } = await http.get<{ items: AdminSessionSummary[]; total: number }>(
    '/admin/sessions',
    { params: { limit } },
  )
  return data
}

export async function getAdminSession(sessionId: string) {
  const { data } = await http.get<AdminSessionDetail>(`/admin/sessions/${sessionId}`)
  return data
}

export type StreamHandlers = {
  onStatus?: (payload: Record<string, unknown>) => void
  onToken?: (content: string) => void
  onError?: (payload: Record<string, unknown>) => void
  onDone?: (payload: ChatResponse) => void
}

/** POST SSE：原生 EventSource 不支持 POST，这里手写解析。 */
export async function streamChat(
  message: string,
  sessionId: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  const token = getAuthToken()
  const res = await fetch('/api/v1/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, session_id: sessionId }),
    signal,
  })
  if (res.status === 401) {
    clearAuthToken()
    window.location.href = '/login'
    throw new Error('登录已失效')
  }
  if (!res.ok || !res.body) {
    throw new Error(`流式请求失败: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const onAbort = () => {
    void reader.cancel().catch(() => undefined)
  }
  if (signal) {
    if (signal.aborted) {
      onAbort()
      throw new DOMException('Aborted', 'AbortError')
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() || ''

      for (const chunk of chunks) {
        const lines = chunk.split('\n')
        let event = 'message'
        const dataLines: string[] = []
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
        }
        if (!dataLines.length) continue
        let payload: Record<string, unknown> = {}
        try {
          payload = JSON.parse(dataLines.join('\n'))
        } catch {
          continue
        }
        if (event === 'status') handlers.onStatus?.(payload)
        else if (event === 'token' && typeof payload.content === 'string') {
          handlers.onToken?.(payload.content)
        } else if (event === 'error') handlers.onError?.(payload)
        else if (event === 'done') handlers.onDone?.(payload as unknown as ChatResponse)
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function fetchFilters() {
  const { data } = await http.get<FilterOptions>('/data/filters')
  return data
}

export async function fetchOverview(params: Record<string, string | undefined>) {
  const { data } = await http.get<OverviewResponse>('/data/overview', { params })
  return data
}

export async function fetchDataPage(
  resource: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  const { data } = await http.get<DataPage>(`/data/${resource}`, { params })
  return data
}
