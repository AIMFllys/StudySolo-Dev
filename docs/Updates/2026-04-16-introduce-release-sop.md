# 2026-04-16 Introduce 发布与回滚 SOP

## 适用范围

- 仅适用于 `introduce` 子项目静态站点发布。
- 目标访问路径：`/introduce/`

## 发布前检查

### 1) 构建配置一致性

- 确认 `introduce/vite.config.ts` 中 `base` 为 `/introduce/`。
- 确认将要发布的目录是 `introduce/dist`。

### 2) 本地质量门禁

在 `D:/project/Study_1037Solo/StudySolo-Dev/introduce` 执行：

```bash
npm install
npm run lint
npx tsc -b
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

### 3) Nginx 路由核对

确保线上配置满足：

- `location ^~ /introduce/`
- `alias .../introduce/dist/`
- `try_files $uri $uri/ /introduce/index.html;`

## 发布动作清单

1. 在本地产出最新 `dist`。
2. 将 `dist` 同步到服务器约定目录。
3. 执行 `nginx -t` 验证配置。
4. 执行 `nginx -s reload` 热重载。
5. 完成上线后最小回归。

## 上线后最小回归

- `https://studyflow.1037solo.com/introduce/` 首屏可达。
- `assets/*.js` 与 `assets/*.css` 返回 200，无 404。
- 深链访问（如 `/introduce/xxx`）刷新可回退到 `index.html`。
- 主站 `/` 正常，不受 `introduce` 配置污染。
- 浏览器控制台无关键报错。

## 失败回滚清单

### 回滚触发条件

- `/introduce/` 白屏或核心资源 404。
- 深链刷新直接 404。
- 大面积交互失效，影响可用性。

### 回滚步骤

1. 停止继续同步新产物。
2. 将服务器 `introduce` 目录恢复到上一个稳定 `dist` 版本。
3. 再次执行 `nginx -t` 与 `nginx -s reload`。
4. 复测 `introduce` 与主站 `/`。
5. 记录回滚时间点、触发症状与差异版本。

## 发布结论模板

- 发布版本：`introduce-YYYYMMDD-HHMM`
- 质量门禁：`lint/typecheck/build/preview`
- 上线回归：`通过/失败`
- 回滚：`无/已执行`
