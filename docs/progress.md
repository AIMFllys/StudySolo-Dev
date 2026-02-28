# StudySolo 当前状态

> 最后更新：2026-02-28
> 这是唯一一份需要随开发过程不断更新的文件。每次开新对话，把这份文件作为上下文的第一段喂给 AI。

## 已完成的模块和功能

### ✅ MVP 核心（全部完成）

- **认证系统**：注册/登录/登出/Token刷新，Cookie-based JWT，前端 middleware 路由守卫
- **工作流 CRUD**：创建/读取/更新/删除工作流，Supabase RLS 用户隔离
- **AI 双阶段生成**：AI_Analyzer 需求分析 → AI_Planner 工作流规划，Pydantic 验证 + 重试
- **工作流执行引擎**：拓扑排序 → 逐节点 AI 调用 → SSE 流式输出
- **AI 双模型路由**：火山引擎 doubao（简单任务）+ 阿里云百炼 qwen3-turbo（复杂任务）+ 容灾降级
- **前端画布**：@xyflow/react 工作流可视化，AIStepNode 自定义节点
- **Zustand Store**：工作流状态管理，节点/连线/执行状态
- **三层防抖同步**：UI(0ms) → IndexedDB(500ms) → Supabase(4s)
- **前端布局**：Sidebar、Navbar、MobileNav 组件（已创建，数据未贯通）
- **部署脚本**：Nginx 配置、PM2 前端、Gunicorn 后端
- **提示词注入防护**：正则过滤 + 沙箱标记
- **config.yaml 配置中心**：AI 模型/节点路由/容灾配置

### ✅ 规范文档（已创建）

- `docs/architecture.md` — 项目地图
- `docs/naming.md` — 命名规范
- `docs/design.md` — UI 与设计规范
- `docs/api.md` — 接口契约
- `docs/progress.md` — 当前状态（本文件）

## 当前正在做的任务

### 🔧 集成缺陷修复（10 处）

详见 `.kiro/specs/studysolo-integration-fixes/tasks.md`

| # | 缺陷 | 状态 | 优先级 |
|---|------|------|--------|
| 1 | Nginx 域名占位符未替换 | ⬜ 未开始 | P0 |
| 2 | Sidebar 工作流列表为空数组硬编码 | ⬜ 未开始 | P0 |
| 3 | Navbar 新建工作流按钮未绑定回调 | ⬜ 未开始 | P0 |
| 4 | NodeMarkdownOutput 未集成 shiki 代码高亮 | ⬜ 未开始 | P1 |
| 5 | NodeMarkdownOutput 未集成 streamdown 增量渲染 | ⬜ 未开始 | P1 |
| 6 | 右侧边栏 RightPanel 完全缺失 | ⬜ 未开始 | P1 |
| 7 | 移动端 BottomDrawer 未实现 | ⬜ 未开始 | P2 |
| 8 | WorkflowPromptInput 未挂载到画布页 | ⬜ 未开始 | P0 |
| 9 | 运行按钮未挂载到画布页 | ⬜ 未开始 | P0 |
| 10 | 工作流执行结果未自动保存 | ⬜ 未开始 | P0 |

### 🎨 网站重新设计

将现有 OKLCH 灰度主题替换为概念图中的 Deep Midnight Navy 暗色主题 + Glass Morphism 效果。

| 组件 | 状态 |
|------|------|
| globals.css 色彩 Token 替换 | ⬜ 未开始 |
| Sidebar 暗色重设计 | ⬜ 未开始 |
| Navbar 暗色重设计 | ⬜ 未开始 |
| MobileNav 暗色重设计 | ⬜ 未开始 |
| WorkflowCanvas 画布样式 | ⬜ 未开始 |
| 登录/注册页重设计 | ⬜ 未开始 |
| Landing 首页重设计 | ⬜ 未开始 |

## 已知问题和技术债

1. **前端 Supabase 导入不一致**：部分文件用 `createClient`，部分用 `createServerClient`，需统一
2. **globals.css 过于臃肿**：包含大量 Geist/Vercel 设计系统变量，与 StudySolo 设计语言无关，需清理
3. **缺少错误边界**：前端组件缺少 React Error Boundary，AI 调用失败可能白屏
4. **缺少 loading 状态**：部分页面缺少 Suspense fallback 和骨架屏
5. **测试覆盖不足**：属性测试已写但集成测试缺失
6. **config.yaml 硬编码路径**：AI 模型配置中部分 API key 路径为硬编码

## 下一步计划

1. 完成 10 处集成缺陷修复（按 tasks.md 顺序）
2. 完成网站重新设计（匹配概念图）
3. 部署到阿里云 ECS 生产环境
4. 端到端测试验证全流程
