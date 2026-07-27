import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { Line } from '@ant-design/charts'
import dayjs, { type Dayjs } from 'dayjs'
import { fetchDataPage, fetchFilters, fetchOverview } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { FilterOptions, OverviewResponse } from '../types'

const { RangePicker } = DatePicker

type TabKey =
  | 'overview'
  | 'products'
  | 'orders'
  | 'inventory'
  | 'returns'
  | 'ads'
  | 'metrics'
  | 'lifecycle'
  | 'batches'
  | 'freight-rates'
  | 'cost-impact'

function money(v: unknown) {
  const n = Number(v ?? 0)
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '-'
}

function pct(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${(n * 100).toFixed(2)}%`
}

function rangeParams(range?: [Dayjs, Dayjs] | null) {
  if (!range?.[0] || !range?.[1]) return {}
  return {
    date_from: range[0].format('YYYY-MM-DD'),
    date_to: range[1].format('YYYY-MM-DD'),
  }
}

export default function DataPage() {
  const { message } = App.useApp()
  const { isManager } = useAuth()
  const [tab, setTab] = useState<TabKey>('overview')
  const [filters, setFilters] = useState<FilterOptions | null>(null)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    void (async () => {
      try {
        setFilters(await fetchFilters())
      } catch (err) {
        message.error('加载筛选项失败，请确认后端 /api/v1/data 已就绪')
        console.error(err)
      }
    })()
  }, [message])

  const marketplaceOptions = useMemo(
    () => (filters?.marketplaces || []).map((v) => ({ label: v, value: v })),
    [filters],
  )
  const siteOptions = useMemo(
    () => (filters?.sites || []).map((v) => ({ label: v, value: v })),
    [filters],
  )

  async function loadOverview() {
    setLoading(true)
    try {
      const values = form.getFieldsValue()
      const data = await fetchOverview({
        ...rangeParams(values.range),
        marketplace: values.marketplace,
        site: values.site,
      })
      setOverview(data)
    } catch (err) {
      message.error('加载经营总览失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadTable(nextPage = page, nextSize = pageSize) {
    if (tab === 'overview') {
      await loadOverview()
      return
    }
    setLoading(true)
    try {
      const values = form.getFieldsValue()
      const params: Record<string, string | number | boolean | undefined> = {
        page: nextPage,
        page_size: nextSize,
        marketplace: values.marketplace,
        site: values.site,
        category: values.category,
        status: values.status,
        keyword: values.keyword,
        warehouse_code: values.warehouse_code,
        product_sku: values.product_sku,
        batch_no: values.batch_no,
        stage: values.stage,
        current_stage: values.current_stage,
        current_status: values.current_status,
        lane_code: values.lane_code,
        phase: values.phase,
        reason_code: values.reason_code,
        campaign_type: values.campaign_type,
        min_acos: values.min_acos,
        below_safety: values.below_safety || undefined,
        snapshot_date: values.snapshot_date
          ? dayjs(values.snapshot_date).format('YYYY-MM-DD')
          : undefined,
        ...rangeParams(values.range),
      }
      const data = await fetchDataPage(tab, params)
      setRows(data.items)
      setTotal(data.total)
      setPage(data.page)
      setPageSize(data.page_size)
    } catch (err) {
      message.error('查询数据失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    form.resetFields()
    setPage(1)
    void loadTable(1, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const onTableChange = (pagination: TablePaginationConfig) => {
    void loadTable(pagination.current || 1, pagination.pageSize || 20)
  }

  const columnsMap: Record<Exclude<TabKey, 'overview'>, ColumnsType<Record<string, unknown>>> = {
    products: [
      { title: 'SKU', dataIndex: 'sku', width: 140 },
      { title: '中文名', dataIndex: 'name_cn', ellipsis: true },
      { title: '品类', dataIndex: 'category', width: 110 },
      { title: '品牌', dataIndex: 'brand', width: 100 },
      { title: '颜色', dataIndex: 'color', width: 90 },
      { title: '尺寸', dataIndex: 'size', width: 90 },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (v) => <Tag color={v === 'active' ? 'green' : 'default'}>{String(v)}</Tag>,
      },
    ],
    orders: [
      { title: '订单号', dataIndex: 'order_no', width: 160 },
      { title: '日期', dataIndex: 'order_date', width: 120 },
      { title: '平台', dataIndex: 'marketplace', width: 110 },
      { title: '站点', dataIndex: 'site', width: 80 },
      { title: 'GMV(USD)', dataIndex: 'gmv_usd', width: 120, render: money },
      { title: '国家', dataIndex: 'buyer_country', width: 80 },
      { title: '状态', dataIndex: 'status', width: 110 },
    ],
    inventory: [
      { title: '快照日', dataIndex: 'snapshot_date', width: 120 },
      { title: '仓库', dataIndex: 'warehouse_code', width: 120 },
      { title: 'SKU', dataIndex: 'product_sku', width: 140 },
      { title: '可售', dataIndex: 'available_qty', width: 90 },
      { title: '在库', dataIndex: 'on_hand_qty', width: 90 },
      { title: '在途', dataIndex: 'in_transit_qty', width: 90 },
      { title: '安全库存', dataIndex: 'safety_stock', width: 100 },
      {
        title: '风险',
        key: 'risk',
        width: 100,
        render: (_, r) =>
          Number(r.available_qty) < Number(r.safety_stock) ? (
            <Tag color="red">低于安全库存</Tag>
          ) : (
            <Tag color="green">正常</Tag>
          ),
      },
    ],
    returns: [
      { title: '退货单', dataIndex: 'return_no', width: 150 },
      { title: '打开日', dataIndex: 'opened_date', width: 120 },
      { title: 'SKU', dataIndex: 'product_sku', width: 140 },
      { title: '平台', dataIndex: 'marketplace', width: 110 },
      { title: '站点', dataIndex: 'site', width: 80 },
      { title: '原因码', dataIndex: 'reason_code', width: 130 },
      { title: '退款(USD)', dataIndex: 'refund_amount_usd', width: 120, render: money },
      { title: '状态', dataIndex: 'status', width: 100 },
    ],
    ads: [
      { title: '日期', dataIndex: 'spend_date', width: 120 },
      { title: 'SKU', dataIndex: 'product_sku', width: 140 },
      { title: '平台', dataIndex: 'marketplace', width: 110 },
      { title: '站点', dataIndex: 'site', width: 80 },
      { title: '活动类型', dataIndex: 'campaign_type', width: 120 },
      { title: '花费', dataIndex: 'spend_usd', width: 110, render: money },
      { title: '广告销售', dataIndex: 'ad_sales_usd', width: 120, render: money },
      { title: 'ACOS', dataIndex: 'acos', width: 100, render: pct },
      { title: 'ROAS', dataIndex: 'roas', width: 90, render: (v) => Number(v ?? 0).toFixed(2) },
    ],
    metrics: [
      { title: '日期', dataIndex: 'metric_date', width: 120 },
      { title: 'SKU', dataIndex: 'product_sku', width: 140 },
      { title: '平台', dataIndex: 'marketplace', width: 110 },
      { title: '站点', dataIndex: 'site', width: 80 },
      { title: '销量', dataIndex: 'units', width: 90 },
      { title: 'GMV', dataIndex: 'gmv_usd', width: 110, render: money },
      { title: '退货件数', dataIndex: 'refund_units', width: 100 },
      { title: '广告花费', dataIndex: 'ad_spend_usd', width: 110, render: money },
      { title: '转化率', dataIndex: 'conversion_rate', width: 100, render: pct },
      { title: '可售库存', dataIndex: 'available_qty', width: 100 },
    ],
    lifecycle: [
      { title: '时间', dataIndex: 'event_time', width: 170 },
      { title: 'SKU', dataIndex: 'product_sku', width: 150 },
      { title: '批次', dataIndex: 'batch_no', width: 140 },
      { title: '阶段', dataIndex: 'stage', width: 110 },
      { title: '事件', dataIndex: 'event_type', width: 120 },
      {
        title: '状态变化',
        key: 'status',
        width: 160,
        render: (_, r) => `${r.from_status ?? '-'} → ${r.to_status ?? '-'}`,
      },
      { title: '单据', dataIndex: 'ref_no', width: 140 },
      { title: '仓', dataIndex: 'warehouse_code', width: 110 },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
    ],
    batches: [
      { title: '批次号', dataIndex: 'batch_no', width: 150 },
      { title: 'SKU', dataIndex: 'product_sku', width: 150 },
      { title: '采购单', dataIndex: 'po_no', width: 150 },
      { title: '数量', dataIndex: 'quantity', width: 90 },
      { title: '目的仓', dataIndex: 'destination_warehouse', width: 120 },
      { title: '开立日', dataIndex: 'opened_date', width: 120 },
      { title: '当前阶段', dataIndex: 'current_stage', width: 110 },
      { title: '当前状态', dataIndex: 'current_status', width: 110 },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
    ],
    'freight-rates': [
      { title: '日期', dataIndex: 'rate_date', width: 120 },
      { title: '航线', dataIndex: 'lane_code', width: 110 },
      { title: '起运港', dataIndex: 'origin_port', width: 120 },
      { title: '目的区域', dataIndex: 'dest_region', width: 130 },
      { title: '运价(USD)', dataIndex: 'rate_usd', width: 110, render: money },
      { title: 'BAF', dataIndex: 'bunker_usd', width: 100, render: money },
      { title: '合计', dataIndex: 'total_usd', width: 110, render: money },
      { title: '指数', dataIndex: 'index_base', width: 90 },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
    ],
    'cost-impact': [
      { title: '日期', dataIndex: 'metric_date', width: 110 },
      { title: 'SKU', dataIndex: 'product_sku', width: 140 },
      { title: '阶段', dataIndex: 'phase', width: 100 },
      { title: '销量', dataIndex: 'units', width: 80 },
      { title: 'GMV', dataIndex: 'gmv_usd', width: 100, render: money },
      { title: '广告花费', dataIndex: 'ad_spend_usd', width: 100, render: money },
      { title: '广告成交', dataIndex: 'ad_sales_usd', width: 100, render: money },
      { title: '单件海运', dataIndex: 'ocean_freight_unit_usd', width: 100 },
      { title: '海运合计', dataIndex: 'ocean_freight_total_usd', width: 100, render: money },
      { title: '贡献', dataIndex: 'contribution_usd', width: 100, render: money },
      { title: '备注', dataIndex: 'remark', ellipsis: true },
    ],
  }

  const chartData = useMemo(() => {
    const series = overview?.series || []
    return series.flatMap((p) => [
      { date: p.date, type: 'GMV', value: Number(p.gmv_usd) },
      { date: p.date, type: '广告花费', value: Number(p.ad_spend_usd) },
      { date: p.date, type: '退款', value: Number(p.refund_usd) },
    ])
  }, [overview])

  const tabItems = useMemo(() => {
    const all: { key: TabKey; label: string }[] = [
      { key: 'overview', label: '经营总览' },
      { key: 'products', label: '商品' },
      { key: 'orders', label: '订单' },
      { key: 'inventory', label: '库存' },
      { key: 'returns', label: '退货' },
      { key: 'ads', label: '广告' },
      { key: 'metrics', label: 'SKU 日指标' },
      { key: 'lifecycle', label: '生命周期' },
      { key: 'batches', label: '供应批次' },
      { key: 'freight-rates', label: '海运费率' },
      { key: 'cost-impact', label: '费用-营收' },
    ]
    if (isManager) return all
    return all.filter((t) => t.key !== 'freight-rates' && t.key !== 'cost-impact')
  }, [isManager])

  useEffect(() => {
    if (!isManager && (tab === 'freight-rates' || tab === 'cost-impact')) {
      setTab('overview')
    }
  }, [isManager, tab])

  return (
    <div className="data-layout panel" style={{ padding: 16, overflow: 'auto' }}>
      {!isManager ? (
        <Tag color="blue" style={{ marginBottom: 12 }}>
          运营组员视图：已隐藏海运费率、费用-营收及成本类字段
        </Tag>
      ) : null}
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
        items={tabItems}
      />

      <Form
        form={form}
        layout="inline"
        className="filter-bar"
        initialValues={{
          range: [dayjs().subtract(29, 'day'), dayjs()],
        }}
        onFinish={() => void loadTable(1, pageSize)}
      >
        {tab !== 'products' && tab !== 'inventory' && tab !== 'batches' && (
          <Form.Item name="range" label="时间">
            <RangePicker />
          </Form.Item>
        )}
        {tab === 'inventory' && (
          <Form.Item name="snapshot_date" label="快照日">
            <DatePicker />
          </Form.Item>
        )}
        {(tab === 'overview' ||
          tab === 'orders' ||
          tab === 'returns' ||
          tab === 'ads' ||
          tab === 'metrics') && (
          <>
            <Form.Item name="marketplace" label="平台">
              <Select allowClear options={marketplaceOptions} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="site" label="站点">
              <Select allowClear options={siteOptions} style={{ width: 100 }} />
            </Form.Item>
          </>
        )}
        {tab === 'products' && (
          <>
            <Form.Item name="category" label="品类">
              <Select
                allowClear
                style={{ width: 140 }}
                options={(filters?.categories || []).map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
            <Form.Item name="keyword" label="关键词">
              <Input allowClear placeholder="SKU / 名称" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                allowClear
                style={{ width: 120 }}
                options={[
                  { label: 'active', value: 'active' },
                  { label: 'inactive', value: 'inactive' },
                ]}
              />
            </Form.Item>
          </>
        )}
        {tab === 'orders' && (
          <>
            <Form.Item name="status" label="状态">
              <Select
                allowClear
                style={{ width: 130 }}
                options={(filters?.order_statuses || []).map((v) => ({
                  label: v,
                  value: v,
                }))}
              />
            </Form.Item>
            <Form.Item name="keyword" label="订单号">
              <Input allowClear style={{ width: 160 }} />
            </Form.Item>
          </>
        )}
        {tab === 'inventory' && (
          <>
            <Form.Item name="warehouse_code" label="仓库">
              <Select
                allowClear
                style={{ width: 140 }}
                options={(filters?.warehouses || []).map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
            <Form.Item name="product_sku" label="SKU">
              <Input allowClear style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="below_safety" label="仅低于安全库存" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        )}
        {tab === 'returns' && (
          <>
            <Form.Item name="reason_code" label="原因码">
              <Select
                allowClear
                style={{ width: 150 }}
                options={(filters?.reason_codes || []).map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
            <Form.Item name="product_sku" label="SKU">
              <Input allowClear style={{ width: 140 }} />
            </Form.Item>
          </>
        )}
        {tab === 'ads' && (
          <>
            <Form.Item name="campaign_type" label="活动类型">
              <Select
                allowClear
                style={{ width: 140 }}
                options={(filters?.campaign_types || []).map((v) => ({
                  label: v,
                  value: v,
                }))}
              />
            </Form.Item>
            <Form.Item name="min_acos" label="ACOS ≥">
              <InputNumber min={0} max={5} step={0.05} placeholder="如 0.35" />
            </Form.Item>
            <Form.Item name="product_sku" label="SKU">
              <Input allowClear style={{ width: 140 }} />
            </Form.Item>
          </>
        )}
        {tab === 'metrics' && (
          <Form.Item name="product_sku" label="SKU">
            <Input allowClear style={{ width: 140 }} />
          </Form.Item>
        )}
        {(tab === 'lifecycle' || tab === 'batches') && (
          <>
            <Form.Item name="product_sku" label="SKU">
              <Input allowClear placeholder="如 AU-BED" style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="batch_no" label="批次">
              <Input allowClear placeholder="LOT-..." style={{ width: 150 }} />
            </Form.Item>
          </>
        )}
        {tab === 'lifecycle' && (
          <Form.Item name="stage" label="阶段">
            <Select
              allowClear
              style={{ width: 140 }}
              options={[
                'product',
                'listing',
                'purchase',
                'first_leg',
                'inventory',
                'order',
                'last_mile',
                'return',
              ].map((v) => ({ label: v, value: v }))}
            />
          </Form.Item>
        )}
        {tab === 'batches' && (
          <>
            <Form.Item name="current_stage" label="阶段">
              <Select
                allowClear
                style={{ width: 130 }}
                options={['purchase', 'first_leg', 'inventory'].map((v) => ({
                  label: v,
                  value: v,
                }))}
              />
            </Form.Item>
            <Form.Item name="current_status" label="状态">
              <Input allowClear style={{ width: 120 }} />
            </Form.Item>
          </>
        )}
        {tab === 'freight-rates' && (
          <Form.Item name="lane_code" label="航线">
            <Select
              allowClear
              style={{ width: 140 }}
              options={['CN-USWC', 'CN-USEC', 'CN-EU'].map((v) => ({
                label: v,
                value: v,
              }))}
            />
          </Form.Item>
        )}
        {tab === 'cost-impact' && (
          <>
            <Form.Item name="product_sku" label="SKU">
              <Input allowClear style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="phase" label="阶段">
              <Select
                allowClear
                style={{ width: 130 }}
                options={['baseline', 'ad_up', 'ad_down', 'freight_up', 'mixed'].map(
                  (v) => ({ label: v, value: v }),
                )}
              />
            </Form.Item>
            <Form.Item name="marketplace" label="平台">
              <Select allowClear options={marketplaceOptions} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="site" label="站点">
              <Select allowClear options={siteOptions} style={{ width: 100 }} />
            </Form.Item>
          </>
        )}
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              查询
            </Button>
            <Button
              onClick={() => {
                form.resetFields()
                void loadTable(1, pageSize)
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {tab === 'overview' ? (
        <>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}>
              <div className="kpi-card">
                <div className="kpi-label">GMV (USD)</div>
                <div className="kpi-value">{money(overview?.total_gmv_usd)}</div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="kpi-card">
                <div className="kpi-label">销量</div>
                <div className="kpi-value">
                  {(overview?.total_units || 0).toLocaleString()}
                </div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="kpi-card">
                <div className="kpi-label">退款 (USD)</div>
                <div className="kpi-value">{money(overview?.total_refund_usd)}</div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div className="kpi-card">
                <div className="kpi-label">广告花费 (USD)</div>
                <div className="kpi-value">{money(overview?.total_ad_spend_usd)}</div>
              </div>
            </Col>
          </Row>
          <Card className="chart-box" title="趋势（AntV）" loading={loading}>
            <Line
              data={chartData}
              xField="date"
              yField="value"
              seriesField="type"
              height={320}
              yAxis={{
                label: {
                  formatter: (v: string) => `$${Number(v).toLocaleString()}`,
                },
              }}
              legend={{ position: 'top' }}
              smooth
            />
          </Card>
        </>
      ) : (
        <Table
          rowKey={(r) => String(r.id ?? JSON.stringify(r))}
          loading={loading}
          columns={columnsMap[tab]}
          dataSource={rows}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={onTableChange}
        />
      )}
    </div>
  )
}
