<#
.SYNOPSIS
    StudySolo 系统一键诊断脚本

.DESCRIPTION
    调用管理后台 /api/admin/diagnostics/full 端点，
    测试所有 AI 模型、子 Agents、数据库、内部服务的健康状态，
    并将日志与多格式报告统一落盘到 scripts/logs/。

.PARAMETER BaseUrl
    后端地址。默认 http://127.0.0.1:2038；环境变量 STUDYSOLO_BASE_URL 可覆盖。

.PARAMETER AdminToken
    管理员 JWT。可从环境变量 STUDYSOLO_ADMIN_TOKEN 读取。

.PARAMETER Category
    过滤类别：all | database | ai_model | agent | service。默认 all。

.PARAMETER Format
    报告输出格式：all | markdown | json | text。默认 all。

.PARAMETER OutputDir
    日志输出目录。默认 scripts/logs。

.EXAMPLE
    .\scripts\diagnostics\run-diagnostics.ps1

.EXAMPLE
    .\scripts\diagnostics\run-diagnostics.ps1 -Category ai_model -Format json

.NOTES
    退出码：
      0 — 所有组件 healthy
      1 — 存在 unhealthy 组件
      2 — 脚本自身异常（后端未启动、鉴权失败、网络错误）

    编码：UTF-8 with BOM（脚本本身必须含 BOM）
#>

[CmdletBinding()]
param(
    [string]$BaseUrl = $(if ($env:STUDYSOLO_BASE_URL) { $env:STUDYSOLO_BASE_URL } else { "http://127.0.0.1:2038" }),
    [string]$AdminToken = $env:STUDYSOLO_ADMIN_TOKEN,
    [ValidateSet("all", "database", "ai_model", "agent", "service")]
    [string]$Category = "all",
    [ValidateSet("all", "markdown", "json", "text")]
    [string]$Format = "all",
    [string]$OutputDir = "scripts/logs",
    [int]$TimeoutSec = 180
)

$ErrorActionPreference = "Stop"

# ---------- Resolve paths ----------
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..\..") | Select-Object -ExpandProperty Path
$logDir = Join-Path $projectRoot $OutputDir
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath  = Join-Path $logDir "diagnostics-$timestamp.log"
$mdPath   = Join-Path $logDir "diagnostics-$timestamp.md"
$jsonPath = Join-Path $logDir "diagnostics-$timestamp.json"
$txtPath  = Join-Path $logDir "diagnostics-$timestamp.txt"

# ---------- Logger ----------
function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")][string]$Level = "INFO"
    )
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    $color = switch ($Level) {
        "ERROR"   { "Red" }
        "WARN"    { "Yellow" }
        "SUCCESS" { "Green" }
        default   { "Gray" }
    }
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $logPath -Value $line -Encoding UTF8
}

function Save-Utf8 {
    param([string]$Path, [string]$Content)
    # 无 BOM 的 UTF-8（日志/报告）
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

# ---------- Banner ----------
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "  StudySolo System Diagnostics" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

Write-Log "开始系统诊断"
Write-Log "目标后端: $BaseUrl"
Write-Log "类别筛选: $Category"
Write-Log "报告格式: $Format"
Write-Log "日志目录: $logDir"

# ---------- Step 1: Token check (loopback + dev 自动免鉴权) ----------
$isLoopback = $BaseUrl -match "^https?://(127\.0\.0\.1|localhost|\[::1\])(:|/|$)"
if (-not $AdminToken) {
    if ($isLoopback) {
        Write-Log "检测到 loopback 地址，开发模式下后端会自动放行（无需 Token）" "INFO"
    }
    else {
        Write-Log "非 loopback 地址必须提供 AdminToken" "ERROR"
        Write-Log "请设置环境变量 `$env:STUDYSOLO_ADMIN_TOKEN = '<admin-jwt>'" "ERROR"
        Write-Log "或使用 -AdminToken 参数" "ERROR"
        exit 2
    }
}

# ---------- Step 2: Health probe with smart diagnosis ----------
try {
    $health = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Log "健康探测 /api/health ... OK ($($health.StatusCode))"
}
catch {
    $errMsg = $_.Exception.Message
    $errType = $_.Exception.GetType().Name

    # Visual error banner
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║             ❌  后端服务连接失败                           ║" -ForegroundColor Red
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""

    # Categorize error and provide actionable guidance
    if ($errMsg -match "Unable to connect|No connection could be made|actively refused") {
        Write-Host "📍 错误类型: 连接被拒绝 (Connection Refused)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 可能原因:" -ForegroundColor Cyan
        Write-Host "   • 后端服务未启动" -ForegroundColor Gray
        Write-Host "   • 端口 2038 被其他程序占用" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 启动后端服务:" -ForegroundColor White
        if ($isLoopback) {
            Write-Host "      .\scripts\start-studysolo.ps1" -ForegroundColor Yellow
        } else {
            Write-Host "      bash ./scripts/startup/start-studysolo.sh" -ForegroundColor Yellow
        }
        Write-Host "   2. 检查端口占用:" -ForegroundColor White
        Write-Host "      netstat -ano | findstr :2038" -ForegroundColor Yellow
    }
    elseif ($errMsg -match "timeout|timed out|Operation timed out") {
        Write-Host "📍 错误类型: 连接超时 (Connection Timeout)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 可能原因:" -ForegroundColor Cyan
        Write-Host "   • 后端服务正在启动中 (冷启动较慢)" -ForegroundColor Gray
        Write-Host "   • 网络延迟或防火墙拦截" -ForegroundColor Gray
        Write-Host "   • 目标地址不是有效的后端服务" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 等待 10-20 秒后重试 (后端可能正在启动)" -ForegroundColor White
        Write-Host "   2. 检查后端状态:" -ForegroundColor White
        Write-Host "      Invoke-WebRequest -Uri 'http://127.0.0.1:2038/api/health'" -ForegroundColor Yellow
        Write-Host "   3. 确认 BaseUrl 参数正确:" -ForegroundColor White
        Write-Host "      当前值: $BaseUrl" -ForegroundColor Yellow
    }
    elseif ($errMsg -match "404|Not Found") {
        Write-Host "📍 错误类型: 端点不存在 (HTTP 404)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 可能原因:" -ForegroundColor Cyan
        Write-Host "   • 后端版本过旧，缺少诊断端点" -ForegroundColor Gray
        Write-Host "   • URL 路径错误" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 确认后端已更新到最新版本" -ForegroundColor White
        Write-Host "   2. 检查 API 路径是否正确" -ForegroundColor White
    }
    elseif ($errMsg -match "503|Service Unavailable|503") {
        Write-Host "📍 错误类型: 服务不可用 (HTTP 503)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 可能原因:" -ForegroundColor Cyan
        Write-Host "   • 后端正在启动或重启中" -ForegroundColor Gray
        Write-Host "   • 数据库连接失败" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 等待 30 秒后重试" -ForegroundColor White
        Write-Host "   2. 检查后端日志:" -ForegroundColor White
        Write-Host "      Get-Content backend\logs\backend.log -Tail 20" -ForegroundColor Yellow
    }
    else {
        Write-Host "📍 错误类型: 未知网络错误 ($errType)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 详细信息:" -ForegroundColor Cyan
        Write-Host "   $errMsg" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 检查网络连接" -ForegroundColor White
        Write-Host "   2. 确认 BaseUrl 可访问" -ForegroundColor White
        Write-Host "   3. 查看后端日志排查问题" -ForegroundColor White
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
    exit 2
}

# ---------- Step 3: Call diagnostics endpoint ----------
Write-Log "调用 /api/admin/diagnostics/full ..."
$startTime = Get-Date
try {
    $headers = @{}
    if ($AdminToken) {
        $headers["Authorization"] = "Bearer $AdminToken"
        $headers["Cookie"] = "admin_token=$AdminToken"
    }
    Write-Log "（大量 AI 模型并发检测中，预计 10-120 秒，请勿中断）"
    $response = Invoke-RestMethod `
        -Uri "$BaseUrl/api/admin/diagnostics/full" `
        -Method GET `
        -Headers $headers `
        -TimeoutSec $TimeoutSec
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errMsg = $_.Exception.Message

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Red

    if ($statusCode -eq 401) {
        Write-Host "║           ❌  鉴权失败 (HTTP 401)                        ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""

        if ($isLoopback) {
            Write-Host "📍 场景: Loopback 地址免鉴权未生效" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "🔍 可能原因:" -ForegroundColor Cyan
            Write-Host "   • 后端 environment 未设置为 development" -ForegroundColor Gray
            Write-Host "   • AdminJWTMiddleware 未正确配置 loopback 白名单" -ForegroundColor Gray
            Write-Host "   • 后端服务刚重启，中间件未加载" -ForegroundColor Gray
            Write-Host ""
            Write-Host "✅ 建议操作:" -ForegroundColor Green
            Write-Host "   1. 检查后端环境配置:" -ForegroundColor White
            Write-Host "      查看 backend/.env 中 ENVIRONMENT=development" -ForegroundColor Yellow
            Write-Host "   2. 重启后端服务使配置生效:" -ForegroundColor White
            if ($isLoopback) {
                Write-Host "      Ctrl+C 停止后重新运行 .\scripts\start-studysolo.ps1" -ForegroundColor Yellow
            }
            Write-Host "   3. 临时使用 Token (不推荐长期使用):" -ForegroundColor White
            Write-Host "      $env:STUDYSOLO_ADMIN_TOKEN='<your-admin-token>'" -ForegroundColor Yellow
        }
        else {
            Write-Host "📍 场景: 非 Loopback 地址需要提供有效凭证" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "🔍 可能原因:" -ForegroundColor Cyan
            Write-Host "   • 未提供 Admin Token" -ForegroundColor Gray
            Write-Host "   • Token 已过期或无效" -ForegroundColor Gray
            Write-Host ""
            Write-Host "✅ 建议操作:" -ForegroundColor Green
            Write-Host "   1. 获取 Admin Token:" -ForegroundColor White
            Write-Host "      • 登录 /admin-analysis/login" -ForegroundColor Yellow
            Write-Host "      • 浏览器 DevTools → Application → Cookies → admin_token" -ForegroundColor Yellow
            Write-Host "   2. 设置环境变量:" -ForegroundColor White
            Write-Host "      $env:STUDYSOLO_ADMIN_TOKEN='<copied-token>'" -ForegroundColor Yellow
            Write-Host "   3. 或使用参数直接传递:" -ForegroundColor White
            Write-Host "      -AdminToken '<copied-token>'" -ForegroundColor Yellow
        }
    }
    elseif ($statusCode -eq 403) {
        Write-Host "║           ❌  权限不足 (HTTP 403)                          ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "📍 场景: 已鉴权但无权访问诊断端点" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 可能原因:" -ForegroundColor Cyan
        Write-Host "   • 账号已被禁用" -ForegroundColor Gray
        Write-Host "   • 账号权限不足" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 联系管理员确认账号状态" -ForegroundColor White
        Write-Host "   2. 使用具有诊断权限的账号" -ForegroundColor White
    }
    elseif ($statusCode -eq 404) {
        Write-Host "║           ❌  端点不存在 (HTTP 404)                        ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "📍 场景: 诊断端点未找到" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 可能原因:" -ForegroundColor Cyan
        Write-Host "   • 后端版本过旧，缺少诊断功能" -ForegroundColor Gray
        Write-Host "   • 后端路由未正确注册" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 更新后端代码到最新版本" -ForegroundColor White
        Write-Host "   2. 检查 backend/app/api/router.py 诊断路由注册" -ForegroundColor White
    }
    elseif ($statusCode -eq 500) {
        Write-Host "║           ❌  服务器内部错误 (HTTP 500)                    ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "📍 场景: 后端执行诊断时发生异常" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🔍 可能原因:" -ForegroundColor Cyan
        Write-Host "   • 数据库连接失败" -ForegroundColor Gray
        Write-Host "   • AI 模型配置错误导致初始化失败" -ForegroundColor Gray
        Write-Host "   • 其他运行时异常" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 查看后端日志:" -ForegroundColor White
        Write-Host "      Get-Content backend\logs\backend.log -Tail 50" -ForegroundColor Yellow
        Write-Host "   2. 检查数据库连接配置" -ForegroundColor White
        Write-Host "   3. 检查 AI 模型配置 (api keys)" -ForegroundColor White
    }
    elseif ($statusCode -eq 503) {
        Write-Host "║           ❌  服务不可用 (HTTP 503)                        ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "📍 场景: 后端服务正在启动或重启" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 等待 10-30 秒后重试" -ForegroundColor White
        Write-Host "   2. 检查后端日志确认启动状态" -ForegroundColor White
    }
    else {
        Write-Host "║           ❌  调用诊断端点失败                             ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Host "📍 错误详情:" -ForegroundColor Yellow
        Write-Host "   HTTP Status: $statusCode" -ForegroundColor Gray
        Write-Host "   Message: $errMsg" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ 建议操作:" -ForegroundColor Green
        Write-Host "   1. 检查后端服务状态" -ForegroundColor White
        Write-Host "   2. 查看后端日志排查问题" -ForegroundColor White
        Write-Host "   3. 确认 BaseUrl 正确: $BaseUrl" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
    exit 2
}
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)
Write-Log "诊断完成，耗时 ${duration}ms"

# ---------- Step 4: Filter & summarize ----------
$components = $response.components
if ($Category -ne "all") {
    $components = @($components | Where-Object { $_.category -eq $Category })
}

$total     = $components.Count
$healthy   = @($components | Where-Object { $_.status -eq "healthy" }).Count
$unhealthy = $total - $healthy

$summaryLine = "结果摘要: $healthy healthy / $unhealthy unhealthy / $total total"
if ($unhealthy -eq 0) {
    Write-Log $summaryLine "SUCCESS"
}
else {
    Write-Log $summaryLine "WARN"
}

if ($unhealthy -gt 0) {
    Write-Log "发现 unhealthy 组件:" "WARN"
    foreach ($c in $components) {
        if ($c.status -ne "healthy") {
            $errMsg = if ($c.error) { $c.error } else { "(无错误详情)" }
            Write-Log "  - $($c.id) [$($c.category)]: $errMsg" "WARN"
        }
    }
}

# ---------- Step 5: Persist reports ----------
$reports = $response.reports
$written = @()

if ($Format -eq "all" -or $Format -eq "markdown") {
    $mdContent = if ($reports.markdown) { $reports.markdown } else { "# Diagnostics Report`n`nNo markdown content available." }
    Save-Utf8 -Path $mdPath -Content $mdContent
    $written += $mdPath
}
if ($Format -eq "all" -or $Format -eq "json") {
    $jsonContent = if ($response) { ($response | ConvertTo-Json -Depth 10) } else { "{}" }
    Save-Utf8 -Path $jsonPath -Content $jsonContent
    $written += $jsonPath
}
if ($Format -eq "all" -or $Format -eq "text") {
    $txtContent = if ($reports.text) { $reports.text } else { "Diagnostics Report`n`nNo text content available." }
    Save-Utf8 -Path $txtPath -Content $txtContent
    $written += $txtPath
}

Write-Log "报告已保存:"
Write-Log "  主日志: $logPath"
foreach ($p in $written) {
    if ($p -ne "") {
        Write-Log "  报告: $p"
    }
}

# ---------- Step 6: Exit code ----------
$exitCode = if ($unhealthy -eq 0) { 0 } else { 1 }
Write-Log "退出码: $exitCode"

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "  ✓ All components healthy" -ForegroundColor Green
}
else {
    Write-Host "  ✗ $unhealthy unhealthy component(s) found" -ForegroundColor Yellow
    Write-Host "  See report: $mdPath" -ForegroundColor Yellow
}
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

exit $exitCode
