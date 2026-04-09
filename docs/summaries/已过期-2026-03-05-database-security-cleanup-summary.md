<!-- 编码：UTF-8 -->

# 数据库安全大扫除与架构规范闭环

> 📅 日期：2026-03-05  
> 📌 关联版本：v0.3.2（数据库层）

## 背景与目标

在 Supabase Dashboard 中发现大量表带有红色 `UNRESTRICTED` 标签（RLS 未启用），意味着任何拥有 `anon` 公钥的人都可以通过 API 无限制地读写这些表的数据。

安全审计目标：
1. 彻底搞清楚为什么这些表没有 RLS
2. 评估修复方案（快速补丁 vs 重构清理）
3. 选择最符合长期架构规范的方案执行

## 实现过程与架构

### 根因分析

深入排查后发现了一个核心问题 —— **两套并行的用户体系**：

| 体系 | user_id 类型 | 认证方式 | RLS 兼容 |
|------|-------------|---------|---------|
| 遗留体系 | `TEXT` | 自定义 bcrypt + session | ❌ 不兼容 `auth.uid()` (UUID) |
| 现代体系 | `UUID` | Supabase Native Auth | ✅ 完美兼容 |

这就是为什么遗留表无法加 RLS 的技术原因：Supabase 的 `auth.uid()` 返回 UUID，而遗留表的 `user_id` 是 TEXT，类型不匹配。

### 排雷验证

- **全局代码搜索**：在整个 `platform.1037solo.com` 仓库中搜索了所有遗留表名，**零匹配**
- **数据量统计**：除 `users` 表有 1 条测试数据外，其余遗留表全部 **0 条数据**
- **外键依赖链分析**：确认所有依赖都在遗留表内部闭环，不影响新体系表
- **视图检查**：仅有的 2 个视图（`v_daily_signups`, `v_daily_workflow_stats`）只引用新体系表

### 执行方案

选择了最彻底的 **Option C：完全清理**，因为遗留表已被证实为"幽灵表"（Ghost Tables）。

## 核心重构梳理

### Migration: `drop_legacy_ghost_tables_and_secure_remaining`

**Phase 1 — 删除 12 张幽灵表**（CASCADE 清理外键链）

| 删除的表 | 原因 |
|---------|------|
| `users` | 自定义用户表，与 `auth.users` + `user_profiles` 完全冲突 |
| `sessions` | 自定义 session 管理，已被 Supabase JWT 取代 |
| `conversations` | 应为 `pt_conversations`，违反前缀规范且无数据 |
| `messages` | 应为 `pt_messages`，违反前缀规范且无数据 |
| `conversation_folders` | 依赖已删 `users` 表，无数据 |
| `message_feedback` | 依赖已删 `messages` 表，无数据 |
| `user_login_logs` | 依赖已删 `users` 表，无数据 |
| `user_preferences` | 依赖已删 `users` 表，仅 1 条测试数据 |
| `usage_daily` | 被 `ss_usage_daily` 完全取代，无数据 |
| `usage_stats` | 重复统计表，无数据 |
| `user_model_limits` | 依赖已删 `users` 表，无数据 |
| `verification_codes` | 被 `verification_codes_v2` 取代，无数据 |

**Phase 2 — 锁定 5 张共享业务表**

| 表名 | RLS 策略 | 访问方式 |
|------|---------|---------|
| `ai_models` | `USING(false)` | 仅后端 service_role |
| `api_call_logs` | `USING(false)` | 仅后端 service_role |
| `redeem_codes` | `USING(false)` | 仅后端 service_role |
| `redeem_logs` | `USING(false)` | 仅后端 service_role |
| `site_stats` | `USING(false)` | 仅后端 service_role |

### 迁移结果

| 指标 | 迁移前 | 迁移后 |
|------|--------|--------|
| 总表数 | 32 张 | **21 张** |
| UNRESTRICTED 表 | 15 张 | **0 张** |
| RLS 覆盖率 | ~53% | **100%** |
| 安全告警 | 多个 HIGH | **零** |

### 文档同步更新

| 文件 | 变更 |
|------|------|
| `shared/docs/decisions/log.md` | 新增决策 #006 |
| `shared/src/types/database.ts` | 移除 `PlatformLegacyUser`，清理 `PT_LEGACY_*` 常量 |
| `StudySolo/docs/Updates/2026-03-04.md` | 新增 v0.3.2 条目 |

## 踩坑记录

1. **TEXT vs UUID 陷阱**：遗留表的 `user_id` 是 TEXT 类型，直接写 `auth.uid() = user_id` 会因类型不匹配而报错或无法利用索引。理论上可以用 `auth.uid()::text = user_id` 做临时转换，但这不是长久之计。
2. **CASCADE 的威力**：`redeem_logs` 表有一个指向 `users` 的外键约束。删除 `users` 表时 CASCADE 自动移除了这个约束，但保留了 `redeem_logs` 表本身（因为它不是被外键引用的目标）。

## 经验总结

1. **先排雷再动手**：深入排查代码引用和数据量，是选择"修补"还是"清除"的关键依据。如果零引用零数据，直接删除远比维护补丁更安全。
2. **架构规范是最好的安全设计**：遵循 `ss_` / `pt_` / 无前缀的命名规范 + UUID 外键关联 `auth.users`，从根本上杜绝了 RLS 不兼容的问题。
3. **共享 Submodule 的价值**：通过 `shared/docs/decisions/log.md` 记录跨项目决策，确保两个项目的 AI 和开发者都有统一的决策视野。

---

*StudySolo Development Team · 2026-03-05*
