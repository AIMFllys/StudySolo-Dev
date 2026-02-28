# StudySolo UI 与设计规范

> 最后更新：2026-02-28
> 这份文件专门解决 AI 还原设计稿失控的问题。配合 `docs/技术指导/StudySolo概念图/` 中的设计参考图使用。
> 设计必须和概念图**一模一样**。

## 设计语言概述

StudySolo 采用 **Deep Midnight Navy 暗色主题** + **Glass Morphism 毛玻璃效果**，整体风格为科技感、专业、沉浸式。所有页面强制使用暗色模式（`<html class="dark">`），不提供亮色模式切换。

---

## 色彩 Token

### 核心色板

| Token 名 | 十六进制 | 用途 |
|----------|---------|------|
| `primary` | `#6366F1` | Electric Indigo — 主色调，按钮、链接、活跃状态、品牌色 |
| `primary-dark` | `#4F46E5` | 主色悬停态 |
| `accent` | `#10B981` | Emerald Mint — 强调色，成功状态、运行中指示、进度条 |
| `background-dark` | `#020617` | Deep Midnight Navy — 页面背景、侧边栏背景 |
| `surface-dark` | `#0F172A` | 卡片/面板基底色 |
| `surface-glass` | `rgba(15, 23, 42, 0.6)` | 毛玻璃面板背景 |
| `border-dark` | `rgba(255, 255, 255, 0.08)` | 边框色 |
| `text-main` | `#F8FAFC` | 主文字色 |
| `text-muted` | `#94A3B8` | 次要文字色 |

### 状态色

| 状态 | 颜色 | 用途 |
|------|------|------|
| 成功/运行中 | `#10B981` (accent) | 运行中指示灯、成功标签 |
| 错误 | `#EF4444` | 错误状态、警告 |
| 警告 | `#F59E0B` | 数据库负载等中等警告 |
| 信息 | `#6366F1` (primary) | 信息提示、日志节点 |
| 待处理 | `#94A3B8` (text-muted) | 等待中状态 |

### Tailwind CSS 配置

```css
/* globals.css 中的 CSS 变量定义 */
:root {
  --primary: #6366F1;
  --primary-dark: #4F46E5;
  --accent: #10B981;
  --background-dark: #020617;
  --surface-dark: #0F172A;
  --surface-glass: rgba(15, 23, 42, 0.6);
  --border-dark: rgba(255, 255, 255, 0.08);
  --text-main: #F8FAFC;
  --text-muted: #94A3B8;
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

### 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `radius-sm` | `6px` | 小按钮、标签、Badge |
| `radius-md` | `8px` | 输入框、下拉菜单 |
| `radius-lg` | `12px` | 卡片、面板、节点 |
| `radius-xl` | `16px` | 大卡片、模态框 |
| `radius-2xl` | `20px` | 定价卡片 |
| `radius-full` | `9999px` | 头像、搜索框、圆形按钮 |

---

## 毛玻璃效果（Glass Morphism）

### glass-panel（导航栏、侧边栏）

```css
.glass-panel {
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### glass-card（内容卡片）

```css
.glass-card {
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}
.glass-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
}
```

### glass-active（活跃/选中状态卡片）

```css
.glass-active {
  background: linear-gradient(145deg, rgba(99, 102, 241, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%);
  border: 1px solid rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
}
```

---

## 阴影系统

| Token | 值 | 用途 |
|-------|-----|------|
| `shadow-glass` | `0 4px 30px rgba(0, 0, 0, 0.1)` | 毛玻璃面板阴影 |
| `shadow-glow` | `0 0 15px rgba(99, 102, 241, 0.3)` | 主色发光效果（Logo、活跃按钮） |
| `shadow-glow-sm` | `0 0 10px rgba(99, 102, 241, 0.2)` | 小发光效果 |
| `shadow-glow-accent` | `0 0 8px rgba(16, 185, 129, 0.5)` | 绿色发光（成功状态进度条） |

---

## 背景效果

### 网格点阵背景

```css
.bg-grid-pattern {
  background-size: 40px 40px;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
}
```

画布区域使用 `0.05` 透明度：
```css
background-image: radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
```

### 装饰性光晕（订阅页等全屏页面）

```css
/* 左上角紫色光晕 */
.absolute.top-[-20%].left-[20%] {
  width: 500px; height: 500px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.3;
}
/* 右下角绿色光晕 */
.absolute.bottom-[-10%].right-[10%] {
  width: 600px; height: 600px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.2;
}
```

---

## 字体规格

### 字体族

```css
font-family: "Inter", "Noto Sans SC", sans-serif;
font-family-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

- 英文优先使用 Inter
- 中文回退到 Noto Sans SC
- 代码使用系统等宽字体

### 字体档位

| 用途 | size | weight | line-height | 示例 |
|------|------|--------|-------------|------|
| 页面大标题 | `2.25rem` (36px) / `3rem` (48px) | 700 (bold) | 1.2 | 登录页 "构建未来的智能工作流" |
| 区块标题 | `1.5rem` (24px) | 700 (bold) | 1.3 | "欢迎回来, Alex" |
| 卡片标题 | `1rem` (16px) / `1.125rem` (18px) | 600 (semibold) | 1.4 | "系统状态"、"最新动态" |
| 正文 | `0.875rem` (14px) | 400 (regular) | 1.5 | 卡片描述文字 |
| 小字/标签 | `0.75rem` (12px) | 500 (medium) | 1.4 | 侧边栏导航项 |
| 极小字 | `0.625rem` (10px) | 500-700 | 1.3 | Badge、时间戳、状态标签 |
| 代码/等宽 | `0.6875rem` (11px) | 400 | 1.6 | 日志输出、代码块 |

---

## 组件库约定

### 基础组件：Shadcn/UI

- 使用 Shadcn/UI 作为基础组件库
- 所有 Shadcn 组件必须适配暗色主题
- **禁止自造**的组件：Button、Input、Dialog、Toast、Dropdown、Tooltip
- **允许自造**的组件：WorkflowCanvas 节点、Glass 面板、执行日志面板

### 图标：Material Symbols Outlined

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1" rel="stylesheet" />
```

- 统一使用 `material-symbols-outlined` 字体图标
- 图标大小：`text-sm` (14px) / `text-lg` (18px) / `text-xl` (20px) / `text-2xl` (24px)
- 禁止混用 Lucide、Heroicons 等其他图标库

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
- 左侧：品牌展示区，星空背景 + 代码雨动画 + 品牌标语
- 右侧：表单区，glass 风格输入框
- 输入框：`bg-surface-dark/50` 背景，`border-white/10` 边框，聚焦时 `ring-primary/50`
- 主按钮：`bg-primary hover:bg-primary-dark` + `shadow-glow`
- 社交登录：GitHub + Google 双按钮

### 工作空间（三栏布局）

- Header：`h-14`，glass-panel，Logo + 搜索框 + 新建按钮 + 用户头像
- 左侧边栏：`w-[280px]`，`bg-[#020617]`，工作流列表 + 设置/退出
- 主画布：`bg-[#050B1D]`，grid-pattern 背景，工作流节点 + 连线
- 右侧面板：`w-[340px]`，`bg-[#020617]`，执行日志 + Token/成本统计

### 仪表盘概览

- 顶部统计卡片：3 列 glass-card，运行次数/Token消耗/活跃工作流
- 中部：最近工作流列表（2列网格）+ 运行趋势图
- 右侧：系统状态 + 最新动态时间线

### 订阅/定价页

- 居中布局，4 列定价卡片
- 推荐卡片使用 `glass-active` + 上移效果 (`xl:-translate-y-4`)
- 按量加购区域：3 列网格
- 功能对比表格：全宽 glass-panel

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

- 宽度：`w-64` (256px)
- 圆角：`rounded-xl` (12px)
- 背景：glass-card 或 glass-active（运行中）
- 头部：`bg-white/5` 背景 + 底部边框
- 连接点：`w-3 h-3` 圆形，`bg-slate-600`（默认）/ `bg-primary`（活跃）

### 节点状态样式

| 状态 | 边框 | Badge | 图标动画 |
|------|------|-------|---------|
| pending | `border-white/5` | `bg-white/5 text-slate-400` "等待中" | 无 |
| running | `border-primary/40` (glass-active) | `bg-primary/20 text-primary` "运行中" | `animate-spin` |
| done | `border-accent/30` | `bg-accent/10 text-accent` "完成" | 无 |
| error | `border-red-500/30` | `bg-red-500/10 text-red-400` "错误" | 无 |

### 连线样式

- 默认连线：`stroke="#6366F1" stroke-opacity="0.3" stroke-width="2"`
- 活跃连线：渐变 `from-primary to-accent`，`animate-pulse`
- 虚线连线：`stroke-dasharray="5,5"` + `stroke-opacity="0.3"`
