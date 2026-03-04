<# 
  一键git.ps1
  
  功能：将 Monorepo 中的 StudySolo 代码同步到独立仓库，并自动提交推送
  方向：platform.1037solo.com\StudySolo → Study_1037Solo\StudySolo
  模式：镜像覆盖（/MIR），排除无关目录和文件
  
  用法：右键 → 使用 PowerShell 运行，或在终端中执行：
    powershell -ExecutionPolicy Bypass -File "scripts\git\一键git.ps1"
    # 或指定提交消息：
    powershell -ExecutionPolicy Bypass -File "scripts\git\一键git.ps1" -Message "feat: update"
#>

param(
    [string]$Message = ""
)

$ErrorActionPreference = "SilentlyContinue"
$Host.UI.RawUI.WindowTitle = "🚀 StudySolo Git 同步神器"

# ==========================================
# 🎨 界面渲染函数
# ==========================================

function Show-Banner {
    Clear-Host
    $banner = @"
                                                                            
    ███████╗████████╗██╗   ██╗██████╗ ██╗   ██╗███████╗ ██████╗ ██╗      ██████╗ 
    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗╚██╗ ██╔╝██╔════╝██╔═══██╗██║     ██╔═══██╗
    ███████╗   ██║   ██║   ██║██║  ██║ ╚████╔╝ ███████╗██║   ██║██║     ██║   ██║
    ╚════██║   ██║   ██║   ██║██║  ██║  ╚██╔╝  ╚════██║██║   ██║██║     ██║   ██║
    ███████║   ██║   ╚██████╔╝██████╔╝   ██║   ███████║╚██████╔╝███████╗╚██████╔╝
    ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝   ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝ 
                                                                             
                         [ 🚀 Git 独立仓库同步引擎 v1.0 ]
    -----------------------------------------------------------------------
"@
    Write-Host $banner -ForegroundColor Cyan
}

function Write-Info($Text) {
    Write-Host "[ ℹ ] $Text" -ForegroundColor Cyan
}

function Write-Success($Text) {
    Write-Host "[ ✔ ] $Text" -ForegroundColor Green
}

function Write-Warning($Text) {
    Write-Host "[ ⚠ ] $Text" -ForegroundColor Yellow
}

function Write-ErrorMsg($Text) {
    Write-Host "[ ✖ ] $Text" -ForegroundColor Red
}

function Show-Spinner($Duration, $Message) {
    $spinner = @('|', '/', '-', '\')
    $counter = 0
    $endTime = (Get-Date).AddSeconds($Duration)
    while ((Get-Date) -lt $endTime) {
        $char = $spinner[$counter % 4]
        Write-Host "`r[ $char ] $Message... " -NoNewline -ForegroundColor Cyan
        Start-Sleep -Milliseconds 100
        $counter++
    }
    Write-Host "`r[ ✔ ] $Message... 完成！    " -ForegroundColor Green
}

# ==========================================
# ⚙️ 核心逻辑配置
# ==========================================

$Source = "D:\project\1037solo\platform.1037solo.com\StudySolo"
$Target = "D:\project\Study_1037Solo\StudySolo"

# 排除的目录
$ExcludeDirs = @(
    ".git"           # 独立仓库有自己的 Git 历史，绝不能覆盖
    "shared"         # 独立仓库有自己的 Git Submodule
    "node_modules"   # 前端依赖，应在目标重新安装
    ".next"          # Next.js 构建缓存
    "venv"           # Python 虚拟环境
    ".venv"          # Python 虚拟环境（另一种命名）
    "__pycache__"    # Python 编译缓存
    ".kiro"          # Kiro AI 工具
    ".agent"         # Agent 工具
    ".cursor"        # Cursor AI 工具
    ".Trae"          # Trae AI 工具
)

# 排除的文件
$ExcludeFiles = @(
    ".DS_Store"
    "Thumbs.db"
    "Desktop.ini"
)

# ==========================================
# 🚀 执行序列
# ==========================================

Show-Banner

Write-Host ""
Write-Host "源目录:  $Source" -ForegroundColor Yellow
Write-Host "目标:    $Target" -ForegroundColor Yellow
Write-Host ""
Write-Host "排除目录: $($ExcludeDirs -join ', ')" -ForegroundColor DarkGray
Write-Host ""

# 检查源目录
if (-not (Test-Path $Source)) {
    Write-ErrorMsg "源目录不存在: $Source"
    Read-Host "按 Enter 退出"
    exit 1
}

# 检查目标目录
if (-not (Test-Path $Target)) {
    Write-ErrorMsg "目标目录不存在: $Target"
    Read-Host "按 Enter 退出"
    exit 1
}

# 检查目标是否有 .git（确保是独立仓库）
if (-not (Test-Path "$Target\.git")) {
    Write-Warning "目标目录没有 .git，可能不是独立仓库!"
    Read-Host "按 Enter 退出"
    exit 1
}

# 确认操作
Write-Warning "这将以镜像模式覆盖独立仓库中的文件，并自动进行 Git Push！"
$confirm = Read-Host "确认同步并推送？(y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Info "已取消同步任务。"
    exit 0
}

Show-Spinner 1 "初始化同步协议"

# ==========================================
# 🔄 阶段 1：同步文件
# ==========================================

Write-Host ""
Write-Host "=== 🔄 阶段 [1/3]: 镜像同步文件 ===" -ForegroundColor Magenta

$robocopyArgs = @(
    $Source
    $Target
    "/MIR"                                    # 镜像模式
    "/XD"                                     # 排除目录
) + $ExcludeDirs + @(
    "/XF"                                     # 排除文件
) + $ExcludeFiles + @(
    "/NFL"                                    # 不显示文件列表
    "/NDL"                                    # 不显示目录列表
    "/NJH"                                    # 不显示 header
    "/NJS"                                    # 不显示 summary
    "/NP"                                     # 不显示进度百分比
)

& robocopy @robocopyArgs

$exitCode = $LASTEXITCODE

if ($exitCode -ge 8) {
    Write-ErrorMsg "同步失败 (robocopy 退出代码: $exitCode)"
    Read-Host "按 Enter 退出"
    exit 1
}

Show-Spinner 1 "核验同步状态"
Write-Success "文件镜像同步已完成！"

# ==========================================
# 📋 阶段 2：Git 变更检测
# ==========================================

Write-Host ""
Write-Host "=== 📋 阶段 [2/3]: Git 变更检测 ===" -ForegroundColor Magenta

Push-Location $Target
$changes = git status --short
if (-not $changes) {
    Write-Warning "没有检测到任何代码变更，引擎无需执行推送。"
    Pop-Location
    Write-Host ""
    Read-Host "按 Enter 退出"
    exit 0
}

Write-Info "检测到以下变更："
Write-Host $changes -ForegroundColor DarkGray
Write-Host ""

# 获取提交消息
if (-not $Message) {
    Write-Host "💬 请输入你的 Commit 描述 [直接回车将使用自动时间戳]" -ForegroundColor Yellow
    $Message = Read-Host " >"
    if (-not $Message) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        $Message = "sync: update from monorepo ($timestamp)"
    }
}

Show-Spinner 1 "正在打包数据变更"

# ==========================================
# 🚀 阶段 3：提交与推送
# ==========================================

Write-Host ""
Write-Host "=== 🚀 阶段 [3/3]: 提交并推送 ===" -ForegroundColor Magenta
Write-Host "   目标分支: origin/main" -ForegroundColor DarkGray
Write-Host "   Commit  : $Message" -ForegroundColor DarkGray
Write-Host ""

git add .
git commit -m $Message
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Success "所有指令已成功执行，代码已到达 AIMFllys/StudySolo！"
}
else {
    Write-Host ""
    Write-Warning "推送过程中可能出现了网络波动或冲突，请检查上方日志输出！"
}

Pop-Location
Write-Host ""
Read-Host "按回车键关闭该终端..."
