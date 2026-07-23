import { Card, Table, Typography } from 'antd'
import { Column, Line } from '@ant-design/charts'
import type { VisualizationSpec } from '../types'

type Props = {
  items?: VisualizationSpec[]
}

export default function MessageVisualizations({ items }: Props) {
  if (!items?.length) return null

  return (
    <div className="msg-viz-list">
      {items.map((viz, idx) => {
        const key = `${viz.type}-${viz.title}-${idx}`
        if (viz.type === 'table') {
          const columns =
            viz.columns?.map((c) => ({
              title: c.title,
              dataIndex: c.dataIndex,
              key: c.key || c.dataIndex,
              ellipsis: true,
            })) ||
            (viz.data?.[0]
              ? Object.keys(viz.data[0]).map((k) => ({
                  title: k,
                  dataIndex: k,
                  key: k,
                  ellipsis: true,
                }))
              : [])
          return (
            <Card key={key} size="small" className="msg-viz-card" title={viz.title || '表格'}>
              <Table
                size="small"
                rowKey={(_, i) => String(i)}
                columns={columns}
                dataSource={viz.data || []}
                pagination={
                  (viz.data?.length || 0) > 8
                    ? { pageSize: 8, size: 'small' }
                    : false
                }
                scroll={{ x: true }}
              />
            </Card>
          )
        }

        if (viz.type === 'line' || viz.type === 'column' || viz.type === 'bar') {
          const xField = viz.xField || 'x'
          const yField = viz.yField || 'y'
          const common = {
            data: viz.data || [],
            xField,
            yField,
            height: 260,
            autoFit: true,
            legend: viz.seriesField ? { position: 'top' as const } : false,
          }
          return (
            <Card key={key} size="small" className="msg-viz-card" title={viz.title || '图表'}>
              {(viz.data?.length || 0) < 2 ? (
                <Typography.Text type="secondary">数据点不足，无法绘图</Typography.Text>
              ) : viz.type === 'line' ? (
                <Line
                  {...common}
                  seriesField={viz.seriesField || undefined}
                  smooth
                />
              ) : (
                <Column {...common} seriesField={viz.seriesField || undefined} />
              )}
            </Card>
          )
        }

        return null
      })}
    </div>
  )
}
