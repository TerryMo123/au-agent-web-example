import { useEffect, useMemo, useState } from 'react'
import {
  Collapse,
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

function statusTag(status: string) {
  if (status === 'error') return <Tag color="error">失败/降级</Tag>
  if (status === 'skipped') return <Tag>跳过</Tag>
  return <Tag color="success">成功</Tag>
}

function formatDetailValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value || '—'
  if (Array.isArray(value)) {
    if (!value.length) return '（空）'
    if (value.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return value.map(String).join('、')
    }
    return JSON.stringify(value, null, 2)
  }
  return JSON.stringify(value, null, 2)
}

const DETAIL_LABELS: Record<string, string> = {
  sql_hits: 'SQL 信号',
  rag_hits: 'RAG 信号',
  hybrid_hits: 'Hybrid 信号',
  route: '路由',
  via: '判定方式',
  reason: '原因码',
  llm_invoked: '触发小模型',
  invoked: '已调用',
  raw_preview: '模型原文预览',
  matched_keys: '命中指标',
  matched: '是否匹配',
  item_count: '条目数',
  reason_count: '原因数',
  deferred: '已延后',
  success: 'SQL 成功',
  repaired: 'SQL 已修复',
  row_count: '行数',
  sql_preview: 'SQL 预览',
  error: '错误',
  titles: '文档标题',
  source_count: '引用数',
  has_context: '有上下文',
  has_rag_context: '注入 RAG',
  has_sql: '有 SQL 结果',
  has_rag: '有 RAG 结果',
  answer_chars: '答案字数',
  degraded: '已降级',
  stream_error: '流式错误',
  partial: '部分输出',
  result: '缓存结果',
  follow_up: '追问',
  semantic_allowed: '允许语义缓存',
  score: '相似度',
  mode: '模式',
  fallback_route: '兜底路由',
  metrics: '指标',
  inventory: '库存 Skill',
  ad: '广告 Skill',
  return: '退货 Skill',
  viz_count: '图表数',
  ttft_ms: 'TTFT(ms)',
  has_sql_context: '有 SQL 上下文',
  parallel: '并行执行',
  branch: '并行支路',
  sql_branch_ms: 'SQL 支路耗时(ms)',
  rag_branch_ms: 'RAG 支路耗时(ms)',
  wall_ms: '并行墙钟(ms)',
  branch_total_ms: '本支路总耗时(ms)',
  note: '说明',
  sql_step_count: 'SQL 支路步数',
  rag_step_count: 'RAG 支路步数',
}

function DetailBlock({ detail }: { detail?: Record<string, unknown> }) {
  if (!detail || !Object.keys(detail).length) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        无附加详情
      </Typography.Text>
    )
  }
  const entries = Object.entries(detail).filter(([, v]) => v !== undefined)
  return (
    <div className="trace-step-detail">
      {entries.map(([key, value]) => {
        const text = formatDetailValue(value)
        const multiline = text.includes('\n') || text.length > 80
        return (
          <div key={key} className="trace-detail-row">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {DETAIL_LABELS[key] || key}
            </Typography.Text>
            {multiline ? (
              <pre className="trace-detail-pre">{text}</pre>
            ) : (
              <Typography.Text style={{ fontSize: 12 }}>{text}</Typography.Text>
            )}
          </div>
        )
      })}
    </div>
  )
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
  const viaLabel = trace?.route_via_label || trace?.route_via || meta?.route_via

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
        {viaLabel && <Tag color="blue">{viaLabel}</Tag>}
        {trace?.cache?.hit && (
          <Tag color="cyan">缓存 {trace.cache.mode || 'hit'}</Tag>
        )}
        {trace?.degraded || meta?.degraded ? <Tag color="red">降级</Tag> : null}
        <Tag>总计 {formatMs(total)}</Tag>
        {(trace?.ttft_ms ?? meta?.ttft_ms) != null && (
          <Tag>TTFT {formatMs(trace?.ttft_ms ?? meta?.ttft_ms)}</Tag>
        )}
      </Space>

      {trace?.action_line && trace.action_line.length > 0 && (
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, marginBottom: 10 }}
          ellipsis={{ rows: 2, expandable: true, symbol: '展开行动线' }}
        >
          行动线：{trace.action_line.join(' → ')}
        </Typography.Paragraph>
      )}

      <Collapse
        size="small"
        bordered={false}
        className="trace-collapse"
        items={steps.map((step, idx) => {
          const pct = total > 0 ? Math.min(100, (step.duration_ms / total) * 100) : 0
          const statusColor =
            step.status === 'error'
              ? 'exception'
              : step.status === 'skipped'
                ? 'normal'
                : 'success'
          const hasDetail = Boolean(
            step.detail && Object.keys(step.detail).length > 0,
          )
          const isParallel =
            step.id === 'parallel_sql_rag' || Boolean(step.detail?.parallel)
          const branch = step.detail?.branch
          return {
            key: `${step.id}-${idx}`,
            label: (
              <div className="trace-step-collapse-label">
                <div className="trace-step-head">
                  <Space size={6} wrap>
                    <Typography.Text strong style={{ fontSize: 13 }}>
                      {idx + 1}. {step.label}
                    </Typography.Text>
                    {statusTag(step.status)}
                    {isParallel ? <Tag color="purple">并行</Tag> : null}
                    {branch === 'sql' ? <Tag>SQL</Tag> : null}
                    {branch === 'rag' ? <Tag>RAG</Tag> : null}
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {step.status === 'skipped' && !step.duration_ms
                      ? '跳过'
                      : formatMs(step.duration_ms)}
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
            ),
            children: hasDetail ? (
              <DetailBlock detail={step.detail} />
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                无附加详情
              </Typography.Text>
            ),
          }
        })}
      />
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
            含各用户提问与完整行动线
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
              : '选择左侧会话查看路由 / Skill / 降级详情'}
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
