# 傲基 Agent 前端示例

React + Ant Design 前端，对接 `au-agent-example` 后端。

## 页面

1. **智能问答** `/chat`：会话列表、流式聊天、路由/Skill 徽章
2. **数据看板** `/data`：经营总览（AntV 折线）+ 商品/订单/库存/退货/广告/SKU 日指标表格筛选

## 启动

先启动后端（默认 `http://localhost:8000`），再：

```bash
cd au-agent-web-example
npm install
npm run dev
```

浏览器打开 http://localhost:5173

Vite 已把 `/api` 代理到后端。

## 依赖后端 API

- 聊天：`POST /api/v1/chat/stream`、`/api/v1/sessions*`
- 数据：`GET /api/v1/data/*`（本仓库配套在 `au-agent-example` 中新增）
