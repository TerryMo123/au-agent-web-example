import { useEffect, useMemo, useState } from 'react'
import {
  Empty,
  Layout,
  Progress,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { getAdminSession, listAdminSessions } from '../api/client'
import type {
  AdminSessionDetail,
  AdminSessionSummary,
  ChatMetadata,
  SessionMessage,
  TraceStep,
} from '../types'

const { Sider, Content } = Layout

function roleLabel(role?: string | null) {
  if (role === 'admin') return '管理员'
  if (role === 'manager') return '组长'
  if (role === 'user') return '组员'
  return role || '未知'
}

function formatMs(ms?: number | null) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

/** 兼容改造前仅有扁平 *_ms 的历史消息 */
function resolveSteps(meta?: ChatMetadata): TraceStep[] {
  if (meta?.trace?.steps?.length) return meta.trace.steps
  if (!meta) return []
  const steps: TraceStep[] = []
  const push = (id: string, label: string, ms?: number) => {
    if (ms == null) return
    steps.push({ id, label, status: 'ok', duration_ms: ms, detail: {} })
  }
  push('cache_lookup', '缓存查找', meta.cache_lookup_ms)
  if (meta.cache_hit) {
    steps.push({
      id: 'cache_hit',
      label: `缓存命中（${meta.cache_mode || 'exact'}）`,
      status: 'ok',
      duration_ms: 0,
      detail: {},
    })
    return steps
  }
  push('route', '路由判定', meta.route_ms)
  push('retrieve_sql', 'SQL 检索', meta.sql_ms)
  push('retrieve_rag', 'RAG 检索', meta.rag_ms)
  push('enrich', 'Hybrid Enrichment', meta.enrich_ms)
  push('generate', '答案生成', meta.generate_ms)
  return steps
}

function TraceWaterfall({ meta, route }: { meta?: ChatMetadata; route?: string | null }) {
  const trace = meta?.trace
  const steps = resolveSteps(meta)
  const total =
    trace?.total_ms ??
    meta?.total_ms ??
    steps.reduce((s, x) => s + (x.duration_ms || 0), 0)

  if (!steps.length) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        暂无阶段耗时（旧消息或未写入 trace）
      </Typography.Text>
    )
  }

  return (
    <div className="trace-waterfall">
      <Space wrap size={[8, 8]} style={{ marginBottom: 8 }}>
        {(trace?.route || route) && (
          <Tag color="green">路由 {trace?.route || route}</Tag>
        )}
        {trace?.route_via && <Tag>via {trace.route_via}</Tag>}
        {trace?.cache?.hit && (
          <Tag color="cyan">缓存 {trace.cache.mode || 'hit'}</Tag>
        )}
        {trace?.degraded || meta?.degraded ? <Tag color="red">降级</Tag> : null}
        <Tag>总计 {formatMs(total)}</Tag>
        {(trace?.ttft_ms ?? meta?.ttft_ms) != null && (
          <Tag>TTFT {formatMs(trace?.ttft_ms ?? meta?.ttft_ms)}</Tag>
        )}
      </Space>
      {steps.map((step) => {
        const pct = total > 0 ? Math.min(100, (step.duration_ms / total) * 100) : 0
        const statusColor =
          step.status === 'error' ? 'exception' : step.status === 'skipped' ? 'normal' : 'success'
        return (
          <div key={`${step.id}-${step.label}`} className="trace-step-row">
            <div className="trace-step-head">
              <Typography.Text strong style={{ fontSize: 13 }}>
                {step.label}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {step.status === 'skipped' ? '跳过' : formatMs(step.duration_ms)}
              </Typography.Text>
            </div>
            <Progress
              percent={Number(pct.toFixed(1))}
              size="small"
              status={statusColor}
              showInfo={false}
              strokeColor={step.status === 'skipped' ? '#d9d9d9' : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}

function pairTurns(messages: SessionMessage[]) {
  const turns: { question: SessionMessage; answer?: SessionMessage }[] = []
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i]
    if (m.role === 'user') {
      const next = messages[i + 1]
      turns.push({
        question: m,
        answer: next?.role === 'assistant' ? next : undefined,
      })
      if (next?.role === 'assistant') i += 1
    } else if (m.role === 'assistant') {
      turns.push({
        question: {
          id: -m.id,
          role: 'user',
          content: '（无用户原文）',
          created_at: m.created_at,
        },
        answer: m,
      })
    }
  }
  return turns
}

export default function AdminTracePanel() {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    setLoadingList(true)
    void listAdminSessions(100)
      .then((res) => {
        setSessions(res.items)
        if (res.items[0]) setSessionId(res.items[0].session_id)
      })
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setDetail(null)
      return
    }
    setLoadingDetail(true)
    void getAdminSession(sessionId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false))
  }, [sessionId])

  const turns = useMemo(
    () => (detail ? pairTurns(detail.messages) : []),
    [detail],
  )

  return (
    <Layout className="chat-layout trace-layout">
      <Sider width={280} theme="light" className="panel session-sider">
        <div className="session-sider-header">
          <Typography.Text strong>全员会话</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            含各用户提问与阶段耗时
          </Typography.Text>
        </div>
        <Spin spinning={loadingList}>
          <div className="session-list">
            {sessions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" />
            ) : (
              sessions.map((s) => (
                <button
                  key={s.session_id}
                  type="button"
                  className={`session-item ${sessionId === s.session_id ? 'active' : ''}`}
                  onClick={() => setSessionId(s.session_id)}
                >
                  <div className="session-item-title">{s.title || '未命名会话'}</div>
                  <div className="session-item-meta">
                    <span>
                      {s.display_name || s.username || '未知用户'} · {roleLabel(s.user_role)}
                    </span>
                    <span>{dayjs(s.updated_at).format('MM-DD HH:mm')}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Spin>
      </Sider>

      <Content className="panel chat-main">
        <div className="chat-main-header">
          <Typography.Title level={4} style={{ margin: 0 }}>
            {detail?.title || '执行轨迹'}
          </Typography.Title>
          <Typography.Text type="secondary">
            {detail
              ? `${detail.display_name || detail.username || '未知'} · ${roleLabel(detail.user_role)} · ${detail.messages.length} 条消息`
              : '选择左侧会话查看各阶段耗时'}
          </Typography.Text>
        </div>

        <div className="chat-messages trace-messages">
          <Spin spinning={loadingDetail}>
            {!detail ? (
              <Empty description="请选择会话" />
            ) : turns.length === 0 ? (
              <Empty description="该会话暂无问答" />
            ) : (
              turns.map((turn) => (
                <div key={turn.question.id} className="trace-turn">
                  <div className="trace-q">
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      提问 · {dayjs(turn.question.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Typography.Text>
                    <div className="trace-q-text">{turn.question.content}</div>
                  </div>
                  {turn.answer ? (
                    <div className="trace-a">
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        回答摘要
                      </Typography.Text>
                      <div className="trace-a-text">
                        {turn.answer.content.slice(0, 180)}
                        {turn.answer.content.length > 180 ? '…' : ''}
                      </div>
                      <TraceWaterfall
                        meta={turn.answer.metadata}
                        route={turn.answer.route}
                      />
                    </div>
                  ) : (
                    <Typography.Text type="secondary">尚无助手回复</Typography.Text>
                  )}
                </div>
              ))
            )}
          </Spin>
        </div>
      </Content>
    </Layout>
  )
}
