export type ChatRole = 'user' | 'assistant' | 'system'

export type UserRole = 'admin' | 'manager' | 'user'

export interface AuthUser {
  id: number
  username: string
  role: UserRole
  display_name: string
  permissions?: {
    view_sensitive_finance?: boolean
    view_freight_rates?: boolean
    view_cost_impact?: boolean
    view_purchase_cost?: boolean
    view_agent_trace?: boolean
  }
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface ChatSource {
  title?: string
  category?: string
  doc_id?: string
  score?: number
  snippet?: string
  source_path?: string
}

export interface TraceStep {
  id: string
  label: string
  status: 'ok' | 'skipped' | 'error' | string
  duration_ms: number
  detail?: Record<string, unknown>
}

export interface AgentTrace {
  request_id?: string | null
  mode?: string
  route?: string | null
  route_via?: string | null
  cache?: {
    hit?: boolean
    mode?: string | null
    score?: number | null
    skipped_semantic?: boolean
  }
  degraded?: boolean
  total_ms?: number | null
  ttft_ms?: number | null
  steps?: TraceStep[]
}

export interface ChatMetadata {
  has_sql_context?: boolean
  has_rag_context?: boolean
  has_metrics_context?: boolean
  has_inventory_alert?: boolean
  has_ad_diagnosis?: boolean
  has_return_attribution?: boolean
  degraded?: boolean
  route_via?: 'rule' | 'llm' | 'fallback' | string
  cache_hit?: boolean
  cache_mode?: 'exact' | 'semantic' | string
  cache_score?: number
  cache_matched_question?: string
  visualizations?: VisualizationSpec[]
  trace?: AgentTrace
  route_ms?: number
  sql_ms?: number
  rag_ms?: number
  enrich_ms?: number
  retrieve_ms?: number
  generate_ms?: number
  ttft_ms?: number
  total_ms?: number
  cache_lookup_ms?: number
  request_id?: string
}

export interface VisualizationSpec {
  type: 'table' | 'line' | 'column' | 'bar'
  title?: string
  columns?: { title: string; dataIndex: string; key?: string }[]
  data?: Record<string, unknown>[]
  xField?: string
  yField?: string
  seriesField?: string | null
}

export interface ChatResponse {
  answer: string
  session_id: string
  route?: string | null
  sources?: ChatSource[]
  metadata?: ChatMetadata
}

export interface SessionSummary {
  session_id: string
  title: string
  status: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface AdminSessionSummary extends SessionSummary {
  user_id?: number | null
  username?: string | null
  display_name?: string | null
  user_role?: string | null
}

export interface SessionMessage {
  id: number
  role: ChatRole
  content: string
  route?: string | null
  sources?: ChatSource[]
  metadata?: ChatMetadata
  created_at: string
}

export interface SessionDetail {
  session_id: string
  title: string
  status: string
  created_at: string
  updated_at: string
  messages: SessionMessage[]
}

export interface AdminSessionDetail extends SessionDetail {
  user_id?: number | null
  username?: string | null
  display_name?: string | null
  user_role?: string | null
}

export interface DataPage<T = Record<string, unknown>> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface FilterOptions {
  marketplaces: string[]
  sites: string[]
  categories: string[]
  warehouses: string[]
  reason_codes: string[]
  order_statuses: string[]
  campaign_types: string[]
}

export interface OverviewPoint {
  date: string
  gmv_usd: number
  units: number
  refund_usd: number
  ad_spend_usd: number
}

export interface OverviewResponse {
  date_from?: string | null
  date_to?: string | null
  total_gmv_usd: number
  total_units: number
  total_refund_usd: number
  total_ad_spend_usd: number
  series: OverviewPoint[]
}

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  interrupted?: boolean
  route?: string | null
  sources?: ChatSource[]
  metadata?: ChatMetadata
  visualizations?: VisualizationSpec[]
}
