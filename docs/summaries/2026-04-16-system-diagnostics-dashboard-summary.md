# 系统诊断面板实现摘要

**日期**: 2026-04-16  
**完成状态**: ✅ 已完成  
**相关更新**: `docs/updates/2026-04-16-system-diagnostics-dashboard.md`

---

## 一句话总结

为 StudySolo 管理后台新增一键全量系统诊断功能，支持并行测试数据库、AI 模型、子 Agents 和内部服务，生成 Markdown/纯文本/JSON 多格式报告，仅限管理员访问。

---

## 实现范围

### 后端 (Python/FastAPI)

**核心模块**: `app/api/admin_diagnostics.py`

关键组件：
- `DiagnosticsRunner` - 并行检测协调器
- `CheckResult` - 检测结果数据类
- `ComponentStatus` / `DiagnosticsResponse` - Pydantic 响应模型

检测策略：
- 数据库: Supabase `SELECT 1` 查询
- AI 模型: 轻量 `chat.completions` 调用 (max_tokens=1, timeout=10s)
- Agents: HTTP `GET /health/ready` (timeout=5s)
- Embedding: 服务初始化验证

并行控制：
- AI 模型检测使用 `asyncio.Semaphore(5)` 限制最大并发
- 所有检测 `asyncio.gather` 并行执行

**权限体系**:
- `AdminJWTMiddleware` (Cookie-based JWT)
- `get_current_admin` 依赖 (新增于 `app/core/deps.py`)

### 前端 (Next.js/React)

**页面**: `app/(admin)/admin-analysis/diagnostics/page.tsx`

界面结构：
- Header: 标题 + 「运行全检」按钮
- Summary Card: 总体状态 + 统计信息 + 耗时
- Category Cards: 按类别聚合的状态概览 (数据库/AI模型/Agents/内部服务)
- Detailed List: 可展开的错误详情 + 组件详情
- Report Actions: 三种格式复制 + JSON 下载

**服务层**: `services/diagnostics.ts`

工具函数：
- `runDiagnostics()` - API 调用
- `groupComponentsByCategory()` - 数据分组
- `copyToClipboard()` / `downloadAsFile()` - 导出工具
- `formatLatency()` / `formatTimestamp()` - 格式化

---

## 文件变更清单

| 路径 | 变更类型 | 行数变化 |
|------|----------|----------|
| `backend/app/api/admin_diagnostics.py` | 新建 | +596 |
| `backend/app/api/router.py` | 修改 | +2 |
| `backend/app/core/deps.py` | 修改 | +48 |
| `frontend/src/app/(admin)/admin-analysis/diagnostics/page.tsx` | 新建 | +341 |
| `frontend/src/services/diagnostics.ts` | 新建 | +152 |
| `frontend/src/features/admin/shared/AdminSidebar.tsx` | 修改 | +1 |

**总计**: 新建 3 文件 (~1089 行)，修改 3 文件 (~51 行)

---

## 技术决策

### 1. 权限模型
选择复用现有 `admin-analysis` 认证体系：
- ✅ 无需新增登录流程
- ✅ 复用 JWT Cookie 机制
- ✅ 统一审计日志

### 2. 并行策略
AI 模型检测限制最大 5 并发：
- ✅ 避免同时发起大量 HTTP 请求
- ✅ 总耗时控制在 15s 内（目标）
- ✅ 单模型超时 10s，不会阻塞整体

### 3. 错误信息处理
后端自动脱敏：
- ✅ 过滤包含 `api_key` 的错误消息
- ✅ 替换为友好提示 "Authentication failed"
- ✅ 保留足够信息用于排查（URL、错误类型）

### 4. 报告格式
支持三种格式导出：
- **Markdown**: 适合粘贴到 GitHub Issue / 飞书文档
- **纯文本**: 简洁，适合即时通讯工具
- **JSON**: 结构化，适合程序处理 / 自动化分析

---

## 验证结果

**语法检查**:
```bash
python -c "import ast; ast.parse(open('backend/app/api/admin_diagnostics.py', encoding='utf-8').read()); print('Syntax OK')"
# 输出: Syntax OK
```

**关键路径验证**:
- [x] API 端点注册 (`/api/admin/diagnostics/full`)
- [x] 导航栏集成 (侧边栏「系统诊断」项)
- [x] 前端服务层 (`credentialsFetch` 复用)
- [x] 权限依赖注入 (`get_current_admin`)

---

## 使用指南

1. **访问路径**: 登录管理后台 → 系统 → 系统诊断
2. **运行检测**: 点击右上角「运行全检」按钮
3. **查看详情**: 点击故障组件右侧的展开按钮
4. **复制报告**: 页面底部选择 Markdown/纯文本/JSON 格式
5. **下载报告**: 点击「下载 JSON」按钮

---

## 依赖关系

```
admin_diagnostics.py
  ├── app.core.deps (get_current_admin)
  ├── app.core.database (get_db)
  ├── app.services.agent_gateway (AgentGateway, AgentRegistry)
  ├── app.services.ai_catalog_service (_load_catalog_rows, is_provider_configured)
  ├── app.services.llm.provider (get_client)
  ├── app.core.config (get_settings)
  └── app.core.config_loader (get_config)

page.tsx
  ├── @/services/diagnostics (runDiagnostics, etc.)
  └── sonner (toast notifications)
```

---

## 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| AI 模型全量检测超时 | 单模型 10s 超时 + 5 并发限制 |
| 敏感信息泄露 | 后端错误消息脱敏 (api_key 过滤) |
| 诊断接口被滥用 | 仅限 admin 权限 + cookie 绑定 |
| 检测结果不一致 | 无缓存，每次请求实时检测 |

---

## 后续工作

可选增强：
- [ ] 单个组件重试按钮
- [ ] 检测历史记录 / 趋势图表
- [ ] 定时自动检测 + 告警通知
- [ ] PDF 报告导出
- [ ] 移动端响应式优化
