<# 
  sync-to-independent.ps1
  
  功能：将 Monorepo 中的 StudySolo 代码同步到独立仓库
  方向：platform.1037solo.com\StudySolo → Study_1037Solo\StudySolo
  模式：镜像覆盖（/MIR），排除无关目录和文件
  
  用法：右键 → 使用 PowerShell 运行，或在终端中执行：
    powershell -ExecutionPolicy Bypass -File "scripts\git\sync-to-independent.ps1"
#>

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

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Monorepo → StudySolo 独立仓库 同步" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "源目录:  $Source" -ForegroundColor Yellow
Write-Host "目标:    $Target" -ForegroundColor Yellow
Write-Host ""
Write-Host "排除目录: $($ExcludeDirs -join ', ')" -ForegroundColor DarkGray
Write-Host ""

# 检查源目录
if (-not (Test-Path $Source)) {
    Write-Host "❌ 源目录不存在: $Source" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 检查目标目录
if (-not (Test-Path $Target)) {
    Write-Host "❌ 目标目录不存在: $Target" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 检查目标是否有 .git（确保是独立仓库）
if (-not (Test-Path "$Target\.git")) {
    Write-Host "⚠️  目标目录没有 .git，可能不是独立仓库!" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 确认操作
Write-Host "⚠️  这将以镜像模式覆盖目标目录中的文件（排除项除外）" -ForegroundColor Yellow
$confirm = Read-Host "确认同步？(y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "已取消。" -ForegroundColor Gray
    exit 0
}

# 执行 robocopy
Write-Host ""
Write-Host "🔄 开始同步..." -ForegroundColor Green

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

Write-Host ""
if ($exitCode -lt 8) {
    Write-Host "✅ 同步完成！" -ForegroundColor Green
    
    # 显示 git status
    Write-Host ""
    Write-Host "--- 独立仓库 git status ---" -ForegroundColor Cyan
    Push-Location $Target
    git status --short
    Pop-Location
    
    Write-Host ""
    Write-Host "下一步：" -ForegroundColor Yellow
    Write-Host "  cd $Target" -ForegroundColor White
    Write-Host '  git add . && git commit -m "sync: ..." && git push origin main' -ForegroundColor White
} else {
    Write-Host "❌ 同步失败 (robocopy 退出代码: $exitCode)" -ForegroundColor Red
}

Write-Host ""
Read-Host "按 Enter 退出"
