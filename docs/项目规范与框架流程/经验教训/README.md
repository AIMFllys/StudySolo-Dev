# 经验教训总览 — Classic Errors Index

> 集合 StudySolo 项目历史上反复出现的经典错误模式，提供根因、修复方案和防御规则。
> **触发条件**: 遇到生产部署、TS构建、Supabase初始化、Nginx配置、前后端不一致等问题时，优先查阅。

## �� 分类索引

| 类别 | 文件 |
|------|------|
| A. Next.js / TypeScript 构建 | [A-nextjs-ts.md](./A-nextjs-ts.md) |
| B. Supabase 客户端初始化 | [B-supabase.md](./B-supabase.md) |
| C. Nginx / 生产部署 | [C-nginx-deploy.md](./C-nginx-deploy.md) |
| D. 前后端契约漂移 | [D-contract-drift.md](./D-contract-drift.md) |
| E. 静默吞错 (Silent Failures) | [E-silent-failures.md](./E-silent-failures.md) |
| F. 安全漏洞模式 | [F-security.md](./F-security.md) |
| G. 状态管理与同步竞态 | [G-state-sync.md](./G-state-sync.md) |
| H. 数据库与迁移 | [H-database.md](./H-database.md) |

## 🛡️ 通用防御检查表

每次提交前对照：

| # | 检查项 | 文件范围 |
|---|--------|----------|
| 1 | `window` 全局访问用 `declare global` 增广？ | `*.ts` `*.tsx` |
| 2 | 所有环境变量有运行时守卫 + 描述性错误？ | `client.ts` `server.ts` |
| 3 | 没有裸 `except: pass` 或 `.catch(() => null)`？ | `*.py` `*.ts` |
| 4 | Pydantic model 变更后 SQL 列已同步？ | `models/*.py` |
| 5 | 新 `.env` 变量已加到 `.env.example`？ | `.env.example` |
| 6 | Nginx SSE 端点已关闭缓冲？ | `nginx.conf` |
| 7 | 安全密钥无默认值？ | `*.py` env读取 |
| 8 | `useEffect` 异步操作包含 `.catch()`？ | `*.tsx` hooks |
| 9 | 类型只有一个 source of truth？ | `types/*.ts` |
| 10 | 部署前执行了 `rm -rf .next`？ | 部署SOP |
| 11 | 线上问题已用 `nginx -T` 核对最终生效配置？ | 部署 / Nginx |
| 12 | 静态子应用真实目录已用 `ls -lah` 核对，而不是只信文档路径？ | 部署 / 静态资源 |

> **维护规则**: 每次遇到新经典错误，追加到对应分类文件，递增版本号。
