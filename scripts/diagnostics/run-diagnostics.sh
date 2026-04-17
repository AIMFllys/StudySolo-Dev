#!/usr/bin/env bash
# StudySolo 系统一键诊断脚本 (Linux/macOS)
# 镜像 run-diagnostics.ps1 的行为，调用 /api/admin/diagnostics/full 并落盘到 scripts/logs/
#
# 退出码：
#   0 — 所有组件 healthy
#   1 — 存在 unhealthy
#   2 — 脚本异常

set -euo pipefail

BASE_URL="${STUDYSOLO_BASE_URL:-http://127.0.0.1:2038}"
ADMIN_TOKEN="${STUDYSOLO_ADMIN_TOKEN:-}"
CATEGORY="all"
FORMAT="all"
OUTPUT_DIR="scripts/logs"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --base-url) BASE_URL="$2"; shift 2 ;;
        --admin-token) ADMIN_TOKEN="$2"; shift 2 ;;
        --category) CATEGORY="$2"; shift 2 ;;
        --format) FORMAT="$2"; shift 2 ;;
        --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,20p' "$0"
            exit 0
            ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/$OUTPUT_DIR"
mkdir -p "$LOG_DIR"

TS=$(date +%Y%m%d-%H%M%S)
LOG_PATH="$LOG_DIR/diagnostics-$TS.log"
MD_PATH="$LOG_DIR/diagnostics-$TS.md"
JSON_PATH="$LOG_DIR/diagnostics-$TS.json"
TXT_PATH="$LOG_DIR/diagnostics-$TS.txt"

log() {
    local level="${2:-INFO}"
    local ts
    ts="$(date '+%Y-%m-%d %H:%M:%S')"
    local line="[$ts] [$level] $1"
    echo "$line"
    echo "$line" >> "$LOG_PATH"
}

log "开始系统诊断"
log "目标后端: $BASE_URL"
log "类别筛选: $CATEGORY"
log "日志目录: $LOG_DIR"

# loopback + dev 自动免鉴权
IS_LOOPBACK=0
if [[ "$BASE_URL" =~ ^https?://(127\.0\.0\.1|localhost|\[::1\]) ]]; then
    IS_LOOPBACK=1
fi

if [[ -z "$ADMIN_TOKEN" ]]; then
    if [[ "$IS_LOOPBACK" -eq 1 ]]; then
        log "检测到 loopback 地址，开发模式下后端会自动放行（无需 Token）"
    else
        log "非 loopback 地址必须提供 Admin Token (STUDYSOLO_ADMIN_TOKEN 或 --admin-token)" "ERROR"
        exit 2
    fi
fi

# Health probe
if ! curl -fsS --max-time 5 "$BASE_URL/api/health" > /dev/null; then
    log "后端不可达: $BASE_URL/api/health" "ERROR"
    log "请先启动后端 (./scripts/startup/start-studysolo.sh)" "ERROR"
    exit 2
fi
log "健康探测 /api/health ... OK"

# Call diagnostics
log "调用 /api/admin/diagnostics/full ..."
START=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')

AUTH_ARGS=()
if [[ -n "$ADMIN_TOKEN" ]]; then
    AUTH_ARGS=(-H "Authorization: Bearer $ADMIN_TOKEN" -H "Cookie: admin_token=$ADMIN_TOKEN")
fi

HTTP_RESPONSE=$(curl -sS -w "\n%{http_code}" --max-time 60 \
    "${AUTH_ARGS[@]}" \
    "$BASE_URL/api/admin/diagnostics/full" || true)

HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n 1)
BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "401" ]]; then
    log "Admin Token 失效 (HTTP 401)" "ERROR"
    exit 2
fi
if [[ "$HTTP_CODE" != "200" ]]; then
    log "诊断端点返回 HTTP $HTTP_CODE" "ERROR"
    exit 2
fi

END=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
log "诊断完成，耗时 $((END - START))ms"

# Persist reports (JSON always; derive md/text via jq)
echo "$BODY" > "$JSON_PATH"

if command -v jq >/dev/null; then
    UNHEALTHY=$(echo "$BODY" | jq '[.components[] | select(.status != "healthy")] | length')
    HEALTHY=$(echo "$BODY" | jq '[.components[] | select(.status == "healthy")] | length')
    TOTAL=$(echo "$BODY" | jq '.components | length')

    echo "$BODY" | jq -r '.reports.markdown' > "$MD_PATH"
    echo "$BODY" | jq -r '.reports.text' > "$TXT_PATH"

    log "结果摘要: $HEALTHY healthy / $UNHEALTHY unhealthy / $TOTAL total"

    if [[ "$UNHEALTHY" -gt 0 ]]; then
        log "发现 unhealthy 组件:" "WARN"
        echo "$BODY" | jq -r '.components[] | select(.status != "healthy") | "  - \(.id) [\(.category)]: \(.error)"' | while read -r line; do
            log "$line" "WARN"
        done
    fi

    log "报告已保存:"
    log "  主日志: $LOG_PATH"
    log "  Markdown: $MD_PATH"
    log "  JSON: $JSON_PATH"
    log "  纯文本: $TXT_PATH"

    if [[ "$UNHEALTHY" -eq 0 ]]; then
        log "退出码: 0" "INFO"
        exit 0
    else
        log "退出码: 1" "WARN"
        exit 1
    fi
else
    log "未安装 jq，仅保存 JSON 报告" "WARN"
    log "JSON: $JSON_PATH"
    exit 0
fi
