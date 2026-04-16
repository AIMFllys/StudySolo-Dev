# 系统诊断面板 (System Diagnostics Dashboard)

**日期**: 2026-04-16  
**类型**: 功能增强 (Feature)  
**影响范围**: 后端 API + 管理后台前端

---

## 功能概述

为 StudySolo 管理后台新增一键全量系统诊断功能，支持测试所有 AI 模型、子 Agents、数据库及外部服务连通性，生成详细报告并支持多格式一键复制。

---

## 新增功能

### 1. 诊断端点 (Backend)

**路径**: `GET /api/admin/diagnostics/full`

**检测内容**:
| 类别 | 检测项 | 超时时间 |
|------|--------|----------|
| 数据库 | Supabase 连接测试 (`SELECT 1`) | 5s |
| AI 模型 | 所有 `is_enabled=True` 的 SKU，轻量 chat.completions 调用 | 10s/个 (并行，最大5并发) |
| 子 Agents | `agents.yaml` 中所有 `enabled=True` 的 Agent `/health/ready` | 5s/个 (并行) |
| 内部服务 | Embedding 服务初始化检查 | 5s |

**响应格式**:
```json
{
  "timestamp": "2026-01-16T16:01:32+08:00",
  "overall_healthy": true,
  "summary": { "total": 15, "healthy": 14, "unhealthy": 1 },
  "components": [...],
  "reports": {
    "markdown": "...",
    "text": "...",
    "json": "..."
  }
}
```

### 2. 诊断面板页面 (Frontend)

**路径**: `/admin-analysis/diagnostics`

**界面特性**:
- 总体状态概览卡片 (健康/故障)
- 分类状态卡片 (数据库、AI模型、Agents、内部服务)
- 详细组件列表，支持展开查看错误详情
- 一键复制报告 (Markdown / 纯文本 / JSON)
- 一键下载 JSON 报告
- 手动触发检测 (无自动刷新)

**导航位置**: 管理后台侧边栏 → 系统 → 系统诊断 (图标: `stethoscope`)

---

## 技术实现

### 后端文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/api/admin_diagnostics.py` | 新建 | 诊断端点实现，含 DiagnosticsRunner 并行检测类 |
| `backend/app/api/router.py` | 修改 | 注册 admin_diagnostics_router |
| `backend/app/core/deps.py` | 修改 | 新增 `get_current_admin` 依赖函数 |

### 前端文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/app/(admin)/admin-analysis/diagnostics/page.tsx` | 新建 | 诊断面板页面组件 |
| `frontend/src/services/diagnostics.ts` | 新建 | API 客户端 + 报告格式化工具 |
| `frontend/src/features/admin/shared/AdminSidebar.tsx` | 修改 | 添加导航项 `{ href: '/admin-analysis/diagnostics', label: '系统诊断', icon: 'stethoscope', group: 'system' }` |

---

## 安全与权限

- **权限控制**: 仅限管理员访问 (复用 `AdminJWTMiddleware` + `get_current_admin` 依赖)
- **错误信息脱敏**: 后端自动过滤包含 `api_key` 的错误消息
- **并发控制**: AI 模型检测使用信号量限制最大 5 并发，避免资源耗尽

---

## 使用场景

1. **本地开发**: 快速验证所有外部依赖是否配置正确
2. **生产部署后**: 确认所有 AI 供应商和子 Agents 可用
3. **故障排查**: 一键获取完整系统状态报告，便于定位问题
4. **日常巡检**: 管理员定期运行，提前发现潜在问题

---

## 后续优化建议

- [ ] 添加单个组件重试功能
- [ ] 支持历史检测记录对比
- [ ] 添加定时自动检测并告警 (邮件/钉钉)
- [ ] 支持导出 PDF 报告
