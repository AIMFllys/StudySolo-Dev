# C. Nginx / 生产部署错误

## C-01: Nginx alias 尾部斜杠不匹配
**日期**: 2026-03-28
**根因**: location /introduce/ { alias /path/to/dir; } — location 有尾部斜杠但 alias 没有，路径拼接错误
**修复**: alias /path/to/dir/; — alias 尾部必须与 location 尾部对齐
**防御规则**: Nginx alias 规则：location 和 alias 的尾部斜杠必须成对匹配

## C-02: Nginx 缓冲阻断 SSE 流
**日期**: 多次
**根因**: Nginx 默认缓冲代理响应，SSE 逐字流变成一次性延迟输出
**修复**: 在反代 location 块添加 proxy_buffering off; proxy_cache off; proxy_read_timeout 300s;
**防御规则**: 所有 SSE/WebSocket/流式响应端点必须关闭 Nginx 缓冲

## C-03: Next.js trailingSlash 与 Nginx 冲突
**根因**: trailingSlash: true 与 Nginx try_files 冲突，产生 301 重定向无限循环
**修复**: 保持 trailingSlash: false（默认），或 Nginx 精确匹配处理
**防御规则**: Next.js 动态路由项目不要开启 trailingSlash

## C-04: 403 Forbidden — 静态目录 vs 反代混淆
**根因**: Nginx 把 /path/ 当作物理目录 listing，而不是转发给 Node 进程
**修复**: 确保 location /path/ 块包含 proxy_pass http://127.0.0.1:PORT;
**防御规则**: Next.js 动态路由不能用 root/alias + try_files，必须用 proxy_pass

## C-05: .next 缓存残留导致构建不一致
**日期**: 2026-03-29
**根因**: 旧 .next 目录含过时 chunk 和环境变量快照，新构建复用旧缓存
**修复**: 部署前必须 rm -rf .next && npm run build
**防御规则**: 每次 git pull 后必须清除 .next，纳入部署 SOP

## C-06: Python 版本不兼容 FastAPI
**根因**: 服务器默认 Python 3.6，FastAPI 0.115+ 需要 3.8+
**修复**: 通过宝塔面板安装 Python 3.11，重建 venv
**防御规则**: 部署文档必须明确 Python 最低版本，国内用清华镜像加速安装

## C-07: 宝塔展示配置 ≠ Nginx 最终生效配置
**日期**: 2026-03-29
**根因**: 在宝塔面板里反复修改站点配置，但真正生效的规则还会受到 `include /www/server/panel/vhost/nginx/extension/...`、`include /www/server/panel/vhost/rewrite/...` 以及缓存层的共同影响。只看面板内容，无法确认最终接流量的是哪一份配置。
**修复**: 所有线上 Nginx 排查必须先执行 `nginx -T`，只认展开后的最终配置；同时结合 `curl -I 实际 URL` 验证响应头，不再只看面板。
**防御规则**: 宝塔环境下，`nginx -T` 是唯一可信配置源；面板配置、README、记忆都只能作参考，不能代替最终配置核验。

## C-08: proxy_cache 会让首页继续吃旧 HTML
**日期**: 2026-03-29
**根因**: 首页 `/` 被 `proxy_cache cache_one` 命中，虽然 Next.js 已重新构建并输出了新的 `window.__ENV__` 注入脚本，但裸 `/` 仍返回旧 HTML；只有带查询参数的 URL 才拿到新页面，形成“代码已更新、首页仍白屏”的假象。
**修复**: 清空 `/www/server/nginx/proxy_cache_dir/*` 后执行 `nginx -s reload`，再用 `curl -I /` 与 `curl -I '/?_t=时间戳'` 对比 `X-Cache` / `ETag` / `Content-Length`，确认旧首页缓存失效。
**防御规则**: 生产环境凡是出现“改了代码但首页行为不变”，先查缓存命中而不是先怀疑构建失败；必须区分“裸 URL 缓存结果”和“带查询参数的新鲜结果”。

## C-09: Nginx 期待的静态目录必须和服务器真实目录完全一致
**日期**: 2026-03-29
**根因**: `introduce` 线上真实目录最初是 `/www/wwwroot/studyflow.1037solo.com/introduce/index.html + assets/ + images/`，但生效中的 Nginx 却按 `/introduce/dist/...` 查找文件。结果 `/introduce/assets/*.js` 命中静态资源失败，`/introduce/` fallback 又掉回主应用 `location /`，最终由 Next.js 返回 404。
**修复**: 先用 `ls -lah` 核对服务器真实目录，再让“配置匹配目录”或“目录匹配配置”二选一。本次通过补齐 `/www/wwwroot/studyflow.1037solo.com/introduce/dist/` 并同步静态产物，使目录结构与生效 Nginx 规则对齐。
**防御规则**: 生产排障必须同时验证三件事：`nginx -T`、`curl -I 实际 URL`、`ls -lah 实际目录`。静态子应用一旦出现 404/500，不要先猜 alias/try_files，先确认线上真实目录是否与配置完全同构。
