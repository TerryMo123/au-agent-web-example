import axios from 'axios'
import type {
  ChatResponse,
  DataPage,
  FilterOptions,
  OverviewResponse,
  SessionDetail,
  SessionSummary,
} from '../types'

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
})

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
  const res = await fetch('/api/v1/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, session_id: sessionId }),
    signal,
  })
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
