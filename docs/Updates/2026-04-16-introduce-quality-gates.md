# 2026-04-16 Introduce 质量门禁验收记录

## 执行范围

- 项目：`introduce`
- 执行目录：`D:/project/Study_1037Solo/StudySolo-Dev/introduce`
- 目标：完成发布前质量门禁最小闭环（install/lint/typecheck/build/preview）

## 执行命令与结果

1. `npm install`
   - 结果：通过
2. `npm run lint`
   - 结果：未通过（2 个阻断点 + 1 个 warning）
3. `npx tsc -b`
   - 结果：通过
4. `npm run build`
   - 结果：通过
5. `npm run preview -- --host 127.0.0.1 --port 4173`
   - 结果：通过
   - 预览地址：`http://127.0.0.1:4173/introduce/`

## lint 阻断项

- `introduce/code_draft.tsx`
  - `@typescript-eslint/no-unused-vars`（`existsSync` 未使用）
- `introduce/src/components/Hero.tsx`
  - `react-hooks/set-state-in-effect`
- `introduce/src/components/WorkflowDemo.tsx`
  - `react-hooks/set-state-in-effect`

## 构建产物快照

- `dist/assets/index-CVUYNJFj.css` 14.15 kB（gzip 4.03 kB）
- `dist/assets/index-C29wJW9B.js` 348.18 kB（gzip 105.97 kB）

## 人工回归最小清单（建议）

- 首屏：Hero 入场、视差动效、按钮可点击。
- 流程：WorkflowDemo 拖拽平移、节点执行状态切换。
- 叙事：Architecture 分流高亮、AIRouter 策略轮播。
- 降级：`prefers-reduced-motion`、移动端触控导航展开。

## 门禁结论

- `typecheck/build/preview` 已满足发布前置。
- 当前唯一阻断是 `lint` 未全绿；若按严格门禁发布，应先修复 3 项 lint 问题。
