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

## 百度统计（可选）

1. 打开 [百度统计](https://tongji.baidu.com/) → 管理 → 新增网站，填写 `moyong.net`
2. 按提示完成站点验证（或先装代码后验证）
3. **管理 → 代码获取**，复制 `hm.js?` **后面那一串 ID**
4. 本地开发：复制 `.env.example` 为 `.env`：

```bash
VITE_BAIDU_TONGJI_ID=你的统计ID
```

5. 生产构建（在 `au-agent-example` 目录，Compose 会传入 build arg）：

```bash
export VITE_BAIDU_TONGJI_ID=你的统计ID
# 或写入同目录 .env（勿提交真实 ID 到公开仓库）
docker compose -f docker-compose.prod.yml build --no-cache au-agent-web
docker compose -f docker-compose.prod.yml up -d au-agent-web
```

未配置 ID 时不会加载统计脚本。SPA 路由切换会自动补报 pageview。

## 依赖后端 API

- 聊天：`POST /api/v1/chat/stream`、`/api/v1/sessions*`
- 数据：`GET /api/v1/data/*`（本仓库配套在 `au-agent-example` 中新增）
