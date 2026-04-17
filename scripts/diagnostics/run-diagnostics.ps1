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

# ---------- Step 2: Health probe ----------
try {
    $health = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Log "健康探测 /api/health ... OK ($($health.StatusCode))"
}
catch {
    Write-Log "后端不可达: $($_.Exception.Message)" "ERROR"
    Write-Log "请先运行 ./scripts/start-studysolo.ps1 启动后端" "ERROR"
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
    if ($statusCode -eq 401) {
        Write-Log "未通过鉴权 (HTTP 401)" "ERROR"
        if ($isLoopback) {
            Write-Log "loopback 免鉴权仅在 environment=development 时生效，请检查后端 .env" "ERROR"
        }
        else {
            Write-Log "非 loopback 地址必须提供有效 Admin Token" "ERROR"
        }
    }
    else {
        Write-Log "调用诊断端点失败: $($_.Exception.Message)" "ERROR"
    }
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
