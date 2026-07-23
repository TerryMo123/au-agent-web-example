import { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Empty,
  Input,
  Layout,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  streamChat,
} from '../api/client'
import MessageVisualizations from '../components/MessageVisualizations'
import type { SessionMessage, SessionSummary, UiMessage, VisualizationSpec } from '../types'

const { Sider, Content } = Layout
const { TextArea } = Input

const SUGGESTIONS = [
  '近 7 天 Amazon US 的 GMV 是多少？',
  '为什么某产品退货率上升？',
  '哪些 SKU 可售库存低于安全库存？',
  '近 30 天广告 ACOS 超标的投放有哪些？',
]

function metaTags(msg: UiMessage) {
  const tags: { color: string; text: string }[] = []
  const m = msg.metadata
  if (msg.route) {
    const via =
      m?.route_via === 'rule'
        ? '规则'
        : m?.route_via === 'llm'
          ? '小模型'
          : m?.route_via === 'fallback'
            ? '降级'
            : ''
    tags.push({
      color: 'green',
      text: via ? `路由 ${msg.route}·${via}` : `路由 ${msg.route}`,
    })
  }
  if (!m) return tags
  if (m.has_metrics_context) tags.push({ color: 'gold', text: '指标口径' })
  if (m.has_sql_context) tags.push({ color: 'blue', text: 'SQL' })
  if (m.has_rag_context) tags.push({ color: 'purple', text: '知识库' })
  if (m.has_return_attribution) tags.push({ color: 'volcano', text: '退货归因' })
  if (m.has_inventory_alert) tags.push({ color: 'orange', text: '库存预警' })
  if (m.has_ad_diagnosis) tags.push({ color: 'magenta', text: '广告诊断' })
  if (m.cache_hit) {
    const mode = m.cache_mode === 'exact' ? '精确' : '语义'
    const score =
      typeof m.cache_score === 'number' ? ` ${Math.round(m.cache_score * 100)}%` : ''
    tags.push({ color: 'cyan', text: `缓存命中·${mode}${score}` })
  }
  if (m.degraded) tags.push({ color: 'red', text: '降级' })
  if (msg.interrupted) tags.push({ color: 'default', text: '已中断' })
  return tags
}

export default function ChatPage() {
  const { message } = App.useApp()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sending, setSending] = useState(false)
  const [stage, setStage] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamingMsgIdRef = useRef<string | null>(null)

  const title = useMemo(() => {
    const hit = sessions.find((s) => s.session_id === sessionId)
    return hit?.title || '新对话'
  }, [sessions, sessionId])

  function finalizeInterrupted(assistantId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              streaming: false,
              interrupted: true,
              content:
                m.content.trim() ||
                '（已中断，尚未生成内容。可重新提问。）',
            }
          : m,
      ),
    )
  }

  function stopGenerating() {
    const id = streamingMsgIdRef.current
    abortRef.current?.abort()
    abortRef.current = null
    if (id) finalizeInterrupted(id)
    streamingMsgIdRef.current = null
    setSending(false)
    setStage('')
  }

  async function copyAnswer(msg: UiMessage) {
    const text = (msg.content || '').trim()
    if (!text) {
      message.warning('暂无内容可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(msg.id)
      message.success('已复制回答')
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === msg.id ? null : cur))
      }, 1800)
    } catch {
      message.error('复制失败，请手动选择文本')
    }
  }

  async function refreshSessions(selectId?: string | null) {
    setLoadingSessions(true)
    try {
      const data = await listSessions()
      setSessions(data.items)
      if (selectId) setSessionId(selectId)
    } catch (err) {
      message.error('加载会话失败，请确认后端已启动')
      console.error(err)
    } finally {
      setLoadingSessions(false)
    }
  }

  async function openSession(id: string) {
    setSessionId(id)
    try {
      const detail = await getSession(id)
      setMessages(
        detail.messages
          .filter((m: SessionMessage) => m.role === 'user' || m.role === 'assistant')
          .map((m: SessionMessage) => ({
            id: String(m.id),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            route: m.route,
            sources: m.sources,
            metadata: m.metadata,
            visualizations: (m.metadata?.visualizations || []) as VisualizationSpec[],
          })),
      )
    } catch (err) {
      message.error('加载会话详情失败')
      console.error(err)
    }
  }

  async function onNewChat() {
    try {
      const s = await createSession('新会话')
      await refreshSessions(s.session_id)
      setMessages([])
    } catch (err) {
      message.error('创建会话失败')
      console.error(err)
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteSession(id)
      if (sessionId === id) {
        setSessionId(null)
        setMessages([])
      }
      await refreshSessions()
    } catch (err) {
      message.error('删除失败')
      console.error(err)
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || sending) return

    setSending(true)
    setStage('routing')
    setInput('')

    let activeSessionId = sessionId
    if (!activeSessionId) {
      try {
        const s = await createSession(content.slice(0, 24))
        activeSessionId = s.session_id
        setSessionId(activeSessionId)
        await refreshSessions(activeSessionId)
      } catch (err) {
        message.error('创建会话失败')
        setSending(false)
        return
      }
    }

    const userMsg: UiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    }
    const assistantId = `a-${Date.now()}`
    streamingMsgIdRef.current = assistantId
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ])

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat(
        content,
        activeSessionId,
        {
          onStatus: (payload) => {
            if (controller.signal.aborted) return
            if (typeof payload.stage === 'string') setStage(payload.stage)
            if (typeof payload.session_id === 'string' && !sessionId) {
              setSessionId(payload.session_id)
            }
          },
          onToken: (token) => {
            if (controller.signal.aborted) return
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + token, streaming: true }
                  : m,
              ),
            )
          },
          onError: () => {
            if (controller.signal.aborted) return
            message.warning('生成过程出现异常，已尝试降级输出')
          },
          onDone: (done) => {
            if (controller.signal.aborted) return
            const viz = (done.metadata?.visualizations || []) as VisualizationSpec[]
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: done.answer || m.content,
                      streaming: false,
                      interrupted: false,
                      route: done.route,
                      sources: done.sources,
                      metadata: done.metadata,
                      visualizations: viz,
                    }
                  : m,
              ),
            )
            if (done.session_id) {
              setSessionId(done.session_id)
              void refreshSessions(done.session_id)
            }
          },
        },
        controller.signal,
      )
    } catch (err) {
      const aborted =
        (err as Error).name === 'AbortError' || controller.signal.aborted
      if (aborted) {
        finalizeInterrupted(assistantId)
      } else {
        message.error('发送失败，请检查后端服务')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  streaming: false,
                  content: m.content || '抱歉，本次请求失败，请稍后重试。',
                }
              : m,
          ),
        )
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      if (streamingMsgIdRef.current === assistantId) {
        streamingMsgIdRef.current = null
      }
      setSending(false)
      setStage('')
    }
  }

  useEffect(() => {
    void refreshSessions()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, stage])

  return (
    <Layout className="chat-layout">
      <Sider
        width={280}
        theme="light"
        className="panel"
        style={{ marginRight: 12, overflow: 'hidden' }}
      >
        <div style={{ padding: 12 }}>
          <Button type="primary" block icon={<PlusOutlined />} onClick={onNewChat}>
            新建对话
          </Button>
        </div>
        <div style={{ padding: '0 8px 12px', height: 'calc(100% - 56px)', overflow: 'auto' }}>
          <Spin spinning={loadingSessions}>
            {sessions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" />
            ) : (
              sessions.map((s) => (
                <div
                  key={s.session_id}
                  className={`session-item ${sessionId === s.session_id ? 'active' : ''}`}
                  onClick={() => void openSession(s.session_id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div className="session-title">{s.title || '未命名会话'}</div>
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          void onDelete(s.session_id)
                        }}
                      />
                    </Tooltip>
                  </div>
                  <div className="session-meta">
                    {s.message_count} 条 · {dayjs(s.updated_at).format('MM-DD HH:mm')}
                  </div>
                </div>
              ))
            )}
          </Spin>
        </div>
      </Sider>

      <Content className="panel chat-main">
        <div className="chat-main-header">
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Typography.Text type="secondary">
            流式问答 · 支持 SQL / RAG / 库存预警 / 广告诊断 / 退货归因
          </Typography.Text>
        </div>

        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 ? (
            <div className="empty-hint">
              <h3>从经营问题开始</h3>
              <p>试试下面这些问题，或直接输入你的业务疑问</p>
              <Space wrap style={{ justifyContent: 'center', marginTop: 16 }}>
                {SUGGESTIONS.map((q) => (
                  <Button key={q} onClick={() => void send(q)}>
                    {q}
                  </Button>
                ))}
              </Space>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`bubble-row ${m.role}`}>
                <div className={`bubble ${m.role}`}>
                  {m.role === 'assistant' ? (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content || (m.streaming ? '…' : '')}
                      </ReactMarkdown>
                      {!m.streaming && (
                        <MessageVisualizations items={m.visualizations} />
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                  {m.role === 'assistant' && (
                    <div className="bubble-meta">
                      {metaTags(m).map((t) => (
                        <Tag key={t.text} color={t.color}>
                          {t.text}
                        </Tag>
                      ))}
                      {(m.sources || []).slice(0, 3).map((s, idx) => (
                        <Tag key={`${s.doc_id || s.title}-${idx}`}>
                          {s.title || s.category || '来源'}
                        </Tag>
                      ))}
                      {!m.streaming && !!m.content.trim() && (
                        <Tooltip title={copiedId === m.id ? '已复制' : '复制回答'}>
                          <Button
                            type="text"
                            size="small"
                            icon={
                              copiedId === m.id ? <CheckOutlined /> : <CopyOutlined />
                            }
                            onClick={() => void copyAnswer(m)}
                          >
                            {copiedId === m.id ? '已复制' : '复制'}
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {sending && stage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Typography.Text type="secondary">处理中：{stage}</Typography.Text>
              <Button size="small" danger icon={<StopOutlined />} onClick={stopGenerating}>
                停止生成
              </Button>
            </div>
          ) : null}
        </div>

        <div className="chat-composer">
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder={
                sending
                  ? '生成中可点「停止」后继续提问…'
                  : '输入问题，例如：近 30 天床类退货原因分布'
              }
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  if (!sending) void send()
                }
              }}
            />
            {sending ? (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={stopGenerating}
                style={{ height: 'auto' }}
              >
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => void send()}
                style={{ height: 'auto' }}
              >
                发送
              </Button>
            )}
          </Space.Compact>
        </div>
      </Content>
    </Layout>
  )
}
