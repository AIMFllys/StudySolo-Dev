"""System Diagnostics CLI runner (Python).

跨平台 fallback，主要用于：
- CI 环境（无 PowerShell）
- Linux/macOS 本地开发
- 集成到 Agent 自动化流程中调用

用法：
    python run_diagnostics.py --base-url http://127.0.0.1:2038 \
                              --admin-token <token> \
                              --category all \
                              --output-dir scripts/logs

退出码：
    0 — 所有组件 healthy
    1 — 有组件 unhealthy
    2 — 脚本异常（网络/鉴权/后端未启动）
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    import httpx
except ImportError:
    print("ERROR: requires `httpx`. Install: pip install httpx", file=sys.stderr)
    sys.exit(2)


def log(msg: str, level: str = "INFO") -> str:
    """Format a timestamped log line."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    print(line, flush=True)
    return line + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="StudySolo 系统诊断命令行工具")
    parser.add_argument("--base-url", default=os.getenv("STUDYSOLO_BASE_URL", "http://127.0.0.1:2038"))
    parser.add_argument(
        "--admin-token",
        default=os.getenv("STUDYSOLO_ADMIN_TOKEN"),
        help="Admin JWT；也可从环境变量 STUDYSOLO_ADMIN_TOKEN 读取",
    )
    parser.add_argument(
        "--category",
        choices=["all", "database", "ai_model", "agent", "service"],
        default="all",
    )
    parser.add_argument(
        "--output-dir",
        default="scripts/logs",
        help="日志与报告输出目录（相对项目根）",
    )
    parser.add_argument("--timeout", type=int, default=60, help="端点总超时（秒）")
    args = parser.parse_args()

    # loopback + dev 自动免鉴权
    import re
    is_loopback = bool(re.match(r"^https?://(127\.0\.0\.1|localhost|\[::1\])", args.base_url))
    if not args.admin_token:
        if is_loopback:
            log("检测到 loopback 地址，开发模式下后端会自动放行（无需 Token）")
        else:
            log("非 loopback 地址必须提供 --admin-token 或 STUDYSOLO_ADMIN_TOKEN", "ERROR")
            return 2

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    log_path = output_dir / f"diagnostics-{timestamp}.log"
    md_path = output_dir / f"diagnostics-{timestamp}.md"
    json_path = output_dir / f"diagnostics-{timestamp}.json"
    txt_path = output_dir / f"diagnostics-{timestamp}.txt"

    log_buffer: list[str] = []
    log_buffer.append(log(f"开始系统诊断"))
    log_buffer.append(log(f"目标后端: {args.base_url}"))
    log_buffer.append(log(f"类别筛选: {args.category}"))

    # Step 1: health probe
    try:
        with httpx.Client(timeout=5) as client:
            r = client.get(f"{args.base_url}/api/health")
            r.raise_for_status()
            log_buffer.append(log(f"健康探测 /api/health ... OK ({int(r.elapsed.total_seconds() * 1000)}ms)"))
    except Exception as exc:
        log_buffer.append(log(f"后端不可达: {exc}", "ERROR"))
        log_buffer.append(log("请先运行 ./scripts/start-studysolo.ps1 启动后端", "ERROR"))
        log_path.write_text("".join(log_buffer), encoding="utf-8")
        return 2

    # Step 2: call diagnostics endpoint
    log_buffer.append(log("调用 /api/admin/diagnostics/full ..."))
    try:
        with httpx.Client(timeout=args.timeout) as client:
            headers = {}
            cookies = {}
            if args.admin_token:
                headers["Authorization"] = f"Bearer {args.admin_token}"
                cookies["admin_token"] = args.admin_token
            r = client.get(
                f"{args.base_url}/api/admin/diagnostics/full",
                headers=headers,
                cookies=cookies,
            )
            if r.status_code == 401:
                log_buffer.append(log("Admin Token 失效或无权限 (401)", "ERROR"))
                log_path.write_text("".join(log_buffer), encoding="utf-8")
                return 2
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        log_buffer.append(log(f"调用诊断端点失败: {exc}", "ERROR"))
        log_path.write_text("".join(log_buffer), encoding="utf-8")
        return 2

    # Step 3: filter by category
    components = data.get("components", [])
    if args.category != "all":
        components = [c for c in components if c.get("category") == args.category]

    summary = data.get("summary", {})
    healthy = sum(1 for c in components if c.get("status") == "healthy")
    unhealthy = len(components) - healthy

    log_buffer.append(log(f"诊断完成"))
    log_buffer.append(log(f"结果摘要: {healthy} healthy / {unhealthy} unhealthy / {len(components)} total"))

    if unhealthy > 0:
        log_buffer.append(log("发现 unhealthy 组件:", "WARN"))
        for c in components:
            if c.get("status") != "healthy":
                log_buffer.append(log(f"  - {c.get('id')}: {c.get('error')}", "WARN"))

    # Step 4: write reports
    reports = data.get("reports", {})
    md_path.write_text(reports.get("markdown", ""), encoding="utf-8")
    txt_path.write_text(reports.get("text", ""), encoding="utf-8")
    json_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    log_buffer.append(log("报告已保存:"))
    log_buffer.append(log(f"  - {md_path}"))
    log_buffer.append(log(f"  - {json_path}"))
    log_buffer.append(log(f"  - {txt_path}"))

    exit_code = 0 if unhealthy == 0 else 1
    log_buffer.append(log(f"退出码: {exit_code}"))
    log_path.write_text("".join(log_buffer), encoding="utf-8")

    return exit_code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n用户中断", file=sys.stderr)
        sys.exit(2)
    except Exception as exc:
        print(f"未捕获异常: {exc}", file=sys.stderr)
        sys.exit(2)
