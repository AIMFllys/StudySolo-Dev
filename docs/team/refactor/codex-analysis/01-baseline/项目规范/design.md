# StudySolo UI 与设计规范

> 最后更新：2026-03-25
> 这份文件专门解决 AI 还原设计稿失控的问题。配合 `docs/技术指导/StudySolo概念图/` 中的设计参考图使用。
> 设计必须和概念图**一模一样**。

## 设计语言概述

StudySolo 采用 **类纸笔记风格 (Ink & Parchment / Scholarly Blueprint)**，整体风格为学术、严谨、沉浸式、极具高品质实体质感。系统全面拥抱明亮模式（放弃原有强制暗色模式），使用象牙白/纸张色作为主要基底色，墨水蓝/牛津蓝作为主品牌色，结合 0px 尖锐倒角打造严肃专业的科研美学。

---

## 色彩 Token

### 核心色板

| Token 名 | 十六进制 | 用途 |
|----------|---------|------|
| `primary` | `#002147` | Oxford Blue / Ink Blue — 主品牌色，按钮、激活状态、核心边框 |
| `primary-dark` | `#001833` | 主色悬停态，更深的墨水色 |
| `accent` | `#D97706` | Amber / Academic Gold — 强调色，焦点提示、重点标记 |
| `background` | `#F9F9F6` | Ivory Paper — 页面主背景色，模拟象牙白高档纸张 |
| `surface` | `#FFFFFF` | 卡片/面板的主体基底色（纯白以体现文字高对比度） |
| `surface-hover` | `#F1F5F9` | Slate-100 — 列表项、按钮的浅色悬浮态 |
| `border-paper` | `#E2E8F0` | Slate-200 — 纸质内容块的分割线、边框色 |
| `text-main` | `#0F172A` | Slate-900 — 主文字色（深墨水色） |
| `text-muted` | `#64748B` | Slate-500 — 次要说明文字色 |

### 状态色

| 状态 | 颜色 | 用途 |
|------|------|------|
| 成功/运行中 | `#059669` (Emerald) | 运行成功、系统正常、流程推进器 |
| 错误 | `#DC2626` (Red) | 错误状态、严重警告、删除操作 |
| 警告 | `#D97706` (Amber) | 提醒、资源警戒、重要提示 |
| 信息 | `#002147` (Primary) | 一般信息、节点日志 |
| 待处理 | `#94A3B8` (text-muted) | 等待中状态、置灰按钮 |

### Tailwind CSS 配置

```css
/* globals.css 中的 CSS 变量定义 */
:root {
  --primary: #002147;
  --primary-dark: #001833;
  --accent: #D97706;
  --background: #F9F9F6;
  --surface: #FFFFFF;
  --surface-hover: #F1F5F9;
  --border-paper: #E2E8F0;
  --text-main: #0F172A;
  --text-muted: #64748B;
}
```

---

## 间距与圆角

### 间距系统

| Token | 值 | 用途 |
|-------|-----|------|
| `spacing-1` | `4px` | 图标与文字间距、极小间隙 |
| `spacing-2` | `8px` | 紧凑元素间距 |
| `spacing-3` | `12px` | 列表项内边距 |
| `spacing-4` | `16px` | 卡片内边距、标准间距 |
| `spacing-5` | `20px` | 区块内边距 |
| `spacing-6` | `24px` | 区块间距、页面边距 |
| `spacing-8` | `32px` | 大区块间距 |

### 圆角系统 (Sharp 0px Corners)

摒弃现代 Web 习惯的圆角设计，所有组件均使用 **尖锐的 0px 直角**，呼应实体纸张边缘、印刷蓝图、及传统学术文档的严谨无死角的秩序感。

| Token | 值 | 用途 |
|-------|-----|------|
| `radius-none` | `0px` | 卡片、面板、流程节点、输入框、按钮、模态框 |
| `radius-full` | `9999px` | 极少数特定场景的几何修饰（如用户头像、单选框）|

---

## 类纸质感（Ink & Parchment）

### paper-panel（导航栏、侧边栏、主面板）

```css
.paper-panel {
  background: var(--background);
  border: 1px solid var(--border-paper);
  border-radius: 0;
}
```

### paper-card（内容卡片、日志、表单区域）

```css
.paper-card {
  background: var(--surface);
  border: 1px solid var(--border-paper);
  border-radius: 0;
  box-shadow: 2px 2px 0px 0px rgba(15, 23, 42, 0.05); /* 硬质阴影，模仿叠纸 */
  transition: all 0.2s ease;
}
.paper-card:hover {
  border-color: var(--primary);
  box-shadow: 4px 4px 0px 0px rgba(0, 33, 71, 0.1);
  transform: translate(-2px, -2px);
}
```

### paper-active（活跃/选中状态卡片）

```css
.paper-active {
  background: var(--surface-hover);
  border: 1px solid var(--primary);
  box-shadow: 4px 4px 0px 0px rgba(0, 33, 71, 0.15);
}
```

---

## 阴影系统 (硬质下落阴影)

摒弃柔和的发光和扩散阴影，采用硬朗的、无模糊（`blur=0`）的下落阴影（Drop Shadow）来表现文档层次感，仿佛多张纸叠放在一起的侧边投影。

| Token | 值 | 用途 |
|-------|-----|------|
| `shadow-paper` | `2px 2px 0px 0px rgba(15, 23, 42, 0.05)` | 纸质面板默认层级阴影 |
| `shadow-paper-lg` | `4px 4px 0px 0px rgba(0, 33, 71, 0.1)` | 悬浮卡片、交互工具栏的层级阴影 |
| `shadow-ink` | `2px 2px 0px 0px rgba(0, 33, 71, 0.2)` | 活跃的墨水蓝元素阴影（替代纯平按钮） |

---

## 背景效果

### 网格点阵/坐标纸蓝图

模拟科研笔记本或工程图纸的背景网格。

```css
.bg-grid-blueprint {
  background-size: 40px 40px;
  background-image: linear-gradient(to right, rgba(0, 33, 71, 0.05) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0, 33, 71, 0.05) 1px, transparent 1px);
}
```

应用到工作流画布区域：
```css
background-image: linear-gradient(to right, rgba(0, 33, 71, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 33, 71, 0.05) 1px, transparent 1px);
```

### 装饰性印记（替代以往的光晕）

不再使用模糊的光晕效果。如在订阅页等空白全屏页需要视觉丰富，采用底透明度的古典**墨水印章、几何排版线框或拉丁文名言水印**，使其深度融合于纸面白底背景中。

---

## 字体规格

> 最后更新：2026-03-18

### 设计理念："科研美学"字体组合

为体现"学术、严谨、手绘笔记"的质感，项目采用 **衬线体 + 等宽体 + 无衬线体** 三类字体组合：

| 字体角色 | 字体名 | CSS 变量 | Tailwind 类 | 适用场景 |
|---------|--------|----------|-------------|---------|
| **衬线体 (Serif)** | Noto Serif SC (思源宋体) | `--font-serif` | `font-serif` | 所有标题 (h1-h6)、品牌名、描述文字、模态框标题 |
| **等宽体 (Monospace)** | JetBrains Mono | `--font-mono` | `font-mono` | 代码块、技术参数、价格数值、ID、状态标签、快捷键提示 |
| **无衬线 (Sans-serif)** | Inter + Noto Sans SC | `--font-sans` | `font-sans` | 正文、按钮文字、表单控件、基础 UI 文字 |

- **衬线体**具有浓郁的学术气息和书卷感，契合类纸化视觉，模拟科研手稿的排版效果
- **等宽体**视觉精准理性，体现数学逻辑的严密性，在感性纸质氛围中保留工业级生产力美学
- **无衬线体**保证正文可读性和按钮点击舒适度

### 加载链路

```
layout.tsx (next/font/google)
  ├─ Inter           → --font-sans     (CSS Variable)
  ├─ Noto_Sans_SC    → --font-sans-sc  (CSS Variable)
  ├─ JetBrains_Mono  → --font-mono     (CSS Variable)
  └─ Noto_Serif_SC   → --font-serif-sc (CSS Variable)

tokens.css (@theme inline)
  ├─ --font-sans:  var(--font-sans), var(--font-sans-sc), "Inter", "Noto Sans SC", sans-serif
  ├─ --font-serif: var(--font-serif-sc), "Noto Serif SC", "Source Han Serif SC", serif
  └─ --font-mono:  var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace

base.css (@layer base) — 全局级联规则
  ├─ h1-h6      → font-family: var(--font-serif)  (自动应用到所有标题)
  ├─ code/pre/kbd → font-family: var(--font-mono)   (自动应用到所有代码元素)
  └─ button     → font-family: var(--font-sans)    (保持按钮可读性)
```

### 字体档位

| 用途 | size | weight | line-height | 字体 | 示例 |
|------|------|--------|-------------|------|------|
| 页面大标题 | `2.25rem` (36px) / `3rem` (48px) | 700 (bold) | 1.2 | Serif | 登录页 "构建未来的智能工作流" |
| 区块标题 | `1.5rem` (24px) | 700 (bold) | 1.3 | Serif | "欢迎回来, Alex" |
| 卡片标题 | `1rem` (16px) / `1.125rem` (18px) | 600 (semibold) | 1.4 | Serif | "系统状态"、"最新动态" |
| 正文 | `0.875rem` (14px) | 400 (regular) | 1.5 | Sans | 卡片描述文字 |
| 小字/标签 | `0.75rem` (12px) | 500 (medium) | 1.4 | Sans | 侧边栏导航项 |
| 极小字 | `0.625rem` (10px) | 500-700 | 1.3 | Mono | Badge、时间戳、状态标签 |
| 代码/等宽 | `0.6875rem` (11px) | 400 | 1.6 | Mono | 日志输出、代码块、节点 ID |
| 品牌名 | `0.875rem-1.125rem` | 700 (bold) | 1.4 | Serif | Navbar/Landing "StudySolo" |

---

## 组件库约定

### 基础组件：Shadcn/UI

- 所有 Shadcn 组件必须适配明亮的纸面主题 (Scholarly Blueprint)
- **强制约束**：去除所有 Shadcn 默认的由 Tailwind `rounded-md` 产出的倒角，一律替换为 `rounded-none`
- **允许自造**的组件：WorkflowCanvas 节点、纸质版式布局面板、执行日志面板

### 图标：Lucide React + Material Symbols Outlined

**主图标库：Lucide React**

```tsx
import { ChevronRight, Settings, LogOut } from 'lucide-react';
```

- 为当前实际使用的主图标库（`lucide-react`）
- 支持 tree-shaking，按需导入
- 图标大小：默认 24px，可通过 `size` prop 调整

**辅助图标：Material Symbols Outlined**

- 已迁移为本地静态字体资源（非 CDN）
- 仅在少量场景使用，新组件优先用 Lucide React
- 图标大小：`text-sm` (14px) / `text-lg` (18px) / `text-xl` (20px) / `text-2xl` (24px)

### 自定义滚动条

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
```

---

## 响应式断点

| 断点 | 宽度 | 布局变化 |
|------|------|---------|
| `sm` | `640px` | 移动端基础适配 |
| `md` | `768px` | 侧边栏显示/隐藏切换点，底部抽屉 → 右侧面板 |
| `lg` | `1024px` | 侧边栏展开（从图标模式到完整模式） |
| `xl` | `1280px` | 三栏布局完整展示 |
| `2xl` | `1536px` | 最大内容宽度 |

### 布局规则

- **移动端 (< 768px)**：单栏布局，底部导航，节点点击弹出 BottomDrawer
- **平板 (768px - 1024px)**：双栏布局（侧边栏图标模式 + 主内容），右侧面板隐藏
- **桌面 (> 1024px)**：三栏布局（左侧边栏 280px + 主内容 flex-1 + 右侧面板 340px）

### 侧边栏宽度

| 视口 | 宽度 | 模式 |
|------|------|------|
| < 768px | 隐藏 | MobileNav 底部导航替代 |
| 768px - 1024px | `64px` | 图标模式（仅显示图标） |
| > 1024px | `280px` | 完整模式（图标 + 文字） |

---

## 页面设计规范

### 登录/注册页

- 左右分栏布局（桌面端）
- 左侧：学术宣言展示区，象牙白或轻微羊皮纸质感背景，搭配庄重的纯文字排版（Noto Serif SC）
- 右侧：表单区，简洁利落的 0px 直角边框输入框
- 输入框：`bg-surface` 背景，`border-paper` 边框，聚焦时加深 `border-primary`
- 主按钮：`bg-primary text-white hover:bg-primary-dark rounded-none` + `shadow-ink`
- 社交登录：GitHub + Google 双按钮，简洁边框

### 工作空间（三栏布局）

- Header：`h-14`，paper-panel，深蓝底色 Logo + 纯明亮搜框 + 锐利新建按钮
- 左侧边栏：`w-[280px]`，`bg-background`（Ivory Paper），使用细线 `border-r border-paper` 划分工作流列表
- 主画布：`bg-background`（Ivory Paper），blueprint 蓝图坐标背景，工作流节点仿佛散落在纸上的卡片
- 右侧面板：`w-[340px]`，`bg-surface` (White)，执行日志采用等宽字体（JetBrains Mono）密集排版

### 仪表盘概览

- 顶部统计卡片：3 列 paper-card (纯白背景 + 细边框)
- 中部：最近工作流列表（细线网格风格）+ 墨水蓝趋势线形图
- 右侧：系统状态 + 犹如打印日志般的动态时间线

### 订阅/定价页

- 居中布局，4 列直角纸质定价卡片
- 推荐卡片使用 `paper-active` + `shadow-paper-lg` 层叠感 (`xl:-translate-y-2`)
- 功能对比表格：全宽带边框的学术风表格，线条清晰干脆

---

## 动画与过渡

| 效果 | CSS | 用途 |
|------|-----|------|
| 通用过渡 | `transition-all 0.3s ease` | 卡片悬停、按钮状态 |
| 颜色过渡 | `transition-colors` | 链接、图标悬停 |
| 脉冲动画 | `animate-pulse` | 运行中指示灯、加载状态 |
| 旋转动画 | `animate-spin` | 运行中节点图标 |
| 按钮点击 | `active:scale-[0.98]` | 主按钮点击反馈 |
| 选中高亮 | `selection:bg-primary/30 selection:text-white` | 全局文字选中色 |

---

## 节点设计规范（工作流画布）

### 节点卡片

- 宽度：`w-64` (256px) 或根据文字自适应
- 圆角：`rounded-none` (0px)
- 背景：纯白色 `bg-surface`，利用硬边阴影浮现于画布上方
- 头部：清晰的书卷细线分割 `border-b border-paper`
- 连接点：`w-3 h-3` 矩形(`rounded-none`) 或实心点，`bg-slate-400`（默认）/ `bg-primary`（活跃）

### 节点状态样式

| 状态 | 边框 | Badge | 图标状态 |
|------|------|-------|---------|
| pending | `border-paper` | `bg-slate-100 text-slate-500 rounded-none` "等待中" | 静止 |
| running | `border-primary` (paper-active) | `bg-primary/10 text-primary rounded-none` "执行中" | `animate-spin` |
| done | `border-emerald-600` | `bg-emerald-50 text-emerald-700 rounded-none` "成功" | 明确的 check 勾选 |
| error | `border-red-600` | `bg-red-50 text-red-700 rounded-none` "阻断" | 明确的 cross 叉选 |

### 连线样式

- 默认连线：`stroke="#002147" stroke-opacity="0.3" stroke-width="1"` (如同精密的钢笔墨迹)
- 活跃连线：墨水蓝实线 `stroke="#002147" stroke-opacity="0.8"`，附带几何标记移动动画
- 虚线连线：`stroke-dasharray="4,4"` + `stroke-opacity="0.4"` (表示条件分支或弱连接)
