<#
.SYNOPSIS
    StudySolo 全栈本地开发启动神器 (Windows)
.DESCRIPTION
    1. 自动检测并解放后端(2038)和前端(2037)端口。
    2. 自动启动后端虚拟环境和 Uvicorn 服务。
    3. 自动清理 .next 缓存并启动前端 Next.js dev 服务。
    4. 采用高级炫酷的控制台动画和 UI 输出。
.NOTES
    作者: AIMFl
.EXAMPLE
    .\start-studysolo.ps1
#>

param (
    [int]$BackendPort = 2038,
    [int]$FrontendPort = 2037,
    [switch]$StartAgents = $true,
    [switch]$AutoInstallDeps = $true
)

# 动态获取当前脚本所在目录的上一级作为项目根目录
$ProjectDir = (Get-Item -Path $PSScriptRoot).Parent.FullName

$ErrorActionPreference = "SilentlyContinue"
$Host.UI.RawUI.WindowTitle = "🚀 StudySolo Dev Launcher"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [Console]::OutputEncoding

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
                                                                            
"@
    Write-Host $banner -ForegroundColor Cyan
    Write-Host "    [ 宇宙级自动化全栈启动引擎 v1.0 ]" -ForegroundColor DarkGray
    Write-Host "    -----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
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
# 🛠️ 核心逻辑函数
# ==========================================

function Test-And-KillPort([int]$Port, [string]$ServiceName) {
    Write-Info "正在侦测 $ServiceName 端口 ($Port)..."
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    
    if ($connections) {
        Write-Warning "发现 $ServiceName 端口 ($Port) 正被占用！"
        foreach ($conn in $connections) {
            $pidToKill = $conn.OwningProcess
            if ($pidToKill) {
                $process = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "      -> 准备消灭占用进程: $($process.ProcessName) (PID: $pidToKill)" -ForegroundColor DarkGray
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                    Write-Success "已成功解除封印！(终止了 PID: $pidToKill)"
                }
            }
        }
        Start-Sleep -Seconds 1
    }
    else {
        Write-Success "$ServiceName 端口 ($Port) 畅通无阻。"
    }
}

function Get-EnvValue([string]$EnvFile, [string]$Key) {
    if (-not (Test-Path $EnvFile)) {
        return $null
    }
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    if (-not $line) {
        return $null
    }
    return ($line -replace "^\s*$Key\s*=\s*", "").Trim()
}

function Ensure-VenvAndDeps([string]$ServiceDir, [string]$ServiceName) {
    $venvPython = Join-Path $ServiceDir ".venv\Scripts\python.exe"
    $requirementsPath = Join-Path $ServiceDir "requirements.txt"

    if (-not (Test-Path $venvPython)) {
        Write-Warning "$ServiceName 未检测到 .venv，正在自动创建 ..."
        & python -m venv (Join-Path $ServiceDir ".venv")
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $venvPython)) {
            Write-ErrorMsg "$ServiceName 创建虚拟环境失败。"
            return $false
        }
    }

    if (-not $AutoInstallDeps) {
        return $true
    }

    if (Test-Path $requirementsPath) {
        & $venvPython -m pip install --upgrade pip
        & $venvPython -m pip install -r $requirementsPath
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "$ServiceName 依赖安装失败。"
            return $false
        }
    }
    else {
        Write-Warning "$ServiceName 未找到 requirements.txt，跳过依赖安装。"
    }

    return $true
}

function Start-PythonService {
    param (
        [string]$ServiceName,
        [string]$ServiceDir,
        [int]$Port,
        [string]$CommandBody,
        [string[]]$RequiredEnvKeys = @(),
        [string[]]$BlockedEnvValues = @("replace-with-a-strong-secret")
    )

    if (-not (Test-Path $ServiceDir)) {
        Write-ErrorMsg "找不到 $ServiceName 目录: $ServiceDir"
        return $false
    }

    $envPath = Join-Path $ServiceDir ".env"
    foreach ($key in $RequiredEnvKeys) {
        $value = Get-EnvValue -EnvFile $envPath -Key $key
        if ([string]::IsNullOrWhiteSpace($value) -or ($BlockedEnvValues -contains $value)) {
            Write-ErrorMsg "$ServiceName 的 .env 缺少或未正确配置 `$key。请先完善: $envPath"
            return $false
        }
    }

    if (-not (Ensure-VenvAndDeps -ServiceDir $ServiceDir -ServiceName $ServiceName)) {
        return $false
    }

    Test-And-KillPort -Port $Port -ServiceName $ServiceName

    $cmd = "cd '$ServiceDir'; .\.venv\Scripts\Activate.ps1; $CommandBody"
    Start-Process powershell -ArgumentList "-NoExit -Command `"$cmd`"" -WindowStyle Normal
    Write-Success "$ServiceName 启动完成。"
    return $true
}

function Start-Frontend {
    $frontendDir = Join-Path $ProjectDir "frontend"
    if (-not (Test-Path $frontendDir)) {
        Write-ErrorMsg "找不到前端目录: $frontendDir"
        return
    }
    Write-Info "正在构建前端视界 (Next.js)..."
    
    # 清理 .next 缓存，防止旧的 rewrites 配置残留
    $nextCacheDir = Join-Path $frontendDir ".next"
    if (Test-Path $nextCacheDir) {
        Write-Info "清理 .next 缓存..."
        Remove-Item -Recurse -Force $nextCacheDir -ErrorAction SilentlyContinue
        Write-Success ".next 缓存已清理。"
    }
    
    # 自动选择包管理器（优先 pnpm，不可用则降级 npm）
    $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    $packageManager = if ($pnpmCmd) { "pnpm" } else { "npm" }
    if (-not $pnpmCmd) {
        Write-Warning "未检测到 pnpm，自动降级为 npm。"
    }

    # 依赖检查：node_modules 不存在时先提示安装
    $nodeModulesDir = Join-Path $frontendDir "node_modules"
    if (-not (Test-Path $nodeModulesDir)) {
        Write-Warning "未检测到前端依赖，正在打开安装窗口 ..."
        $installCmd = "cd '$frontendDir'; "
        $installCmd += "$packageManager install; "
        $installCmd += "Write-Host ''; "
        $installCmd += "Write-Host '==============================' -ForegroundColor Green; "
        $installCmd += "Write-Host '  前端依赖安装流程已结束' -ForegroundColor Green; "
        $installCmd += "Write-Host '  若安装报网络错误，请重试安装后再启动' -ForegroundColor Yellow; "
        $installCmd += "Write-Host '==============================' -ForegroundColor Green; "
        $installCmd += "Read-Host '按回车键关闭此窗口'"
        Start-Process powershell -ArgumentList "-NoExit -Command `"$installCmd`"" -WindowStyle Normal
        Write-Warning "前端依赖安装窗口已打开，完成后请重新运行本脚本。"
        return
    }
    
    # 启动新窗口执行（显式指定端口）
    $cmd = "cd '$frontendDir'; "
    if ($packageManager -eq "pnpm") {
        $cmd += "pnpm dev --port $FrontendPort"
    }
    else {
        $cmd += "npm run dev -- --port $FrontendPort"
    }
    Start-Process powershell -ArgumentList "-NoExit -Command `"$cmd`"" -WindowStyle Normal
    Write-Success "前端视界面板已展开！"
}

function Start-CoreBackend {
    $backendDir = Join-Path $ProjectDir "backend"
    Write-Info "正在注入主后端引擎 (FastAPI)..."
    return (Start-PythonService `
        -ServiceName "Main Backend" `
        -ServiceDir $backendDir `
        -Port $BackendPort `
        -CommandBody "python -m uvicorn app.main:app --reload --port $BackendPort --host 0.0.0.0")
}

function Start-Agents {
    if (-not $StartAgents) {
        Write-Warning "已按参数跳过 Agent 组启动。"
        return
    }

    Write-Host ""
    Write-Host "=== 🤖 Agent 启动层 ===" -ForegroundColor Magenta

    $agentsRoot = Join-Path $ProjectDir "agents"
    $services = @(
        @{
            Name = "Code Review Agent"
            Dir = Join-Path $agentsRoot "code-review-agent"
            Port = 8001
            Cmd = "python -m src.main"
            RequiredKeys = @("AGENT_API_KEY")
            Blocked = @()
        },
        @{
            Name = "Deep Research Agent"
            Dir = Join-Path $agentsRoot "deep-research-agent"
            Port = 8002
            Cmd = "python -m src.main"
            RequiredKeys = @("AGENT_API_KEY")
            Blocked = @()
        },
        @{
            Name = "News Agent"
            Dir = Join-Path $agentsRoot "news-agent"
            Port = 8003
            Cmd = "python -m src.main"
            RequiredKeys = @("AGENT_API_KEY")
            Blocked = @()
        },
        @{
            Name = "Study Tutor Agent"
            Dir = Join-Path $agentsRoot "study-tutor-agent"
            Port = 8004
            Cmd = "python -m src.main"
            RequiredKeys = @("AGENT_API_KEY")
            Blocked = @("replace-with-a-strong-secret")
        },
        @{
            Name = "Visual Site Agent"
            Dir = Join-Path $agentsRoot "visual-site-agent"
            Port = 8005
            Cmd = "python -m src.main"
            RequiredKeys = @("AGENT_API_KEY")
            Blocked = @("replace-with-a-strong-secret")
        }
    )

    foreach ($svc in $services) {
        Write-Info "正在启动 $($svc.Name) ..."
        Start-PythonService `
            -ServiceName $svc.Name `
            -ServiceDir $svc.Dir `
            -Port $svc.Port `
            -CommandBody $svc.Cmd `
            -RequiredEnvKeys $svc.RequiredKeys `
            -BlockedEnvValues $svc.Blocked | Out-Null
    }
}

# ==========================================
# 🚀 启动序列
# ==========================================

Show-Banner

if (-not (Test-Path $ProjectDir)) {
    Write-ErrorMsg "项目路径不存在: $ProjectDir"
    Write-Host "路径错误，无法启动！"
    Pause
    exit
}

Show-Spinner 1 "初始化全栈启动协议"

# 1. 端口检查与释放（前端）
Write-Host ""
Write-Host "=== 🛡️ 资源接管层 ===" -ForegroundColor Magenta
Test-And-KillPort $FrontendPort "Frontend"

Show-Spinner 1 "正在分配运行内存与通道"

# 2. 启动服务
Write-Host ""
Write-Host "=== ⚙️ 核心启动层 ===" -ForegroundColor Magenta
Start-CoreBackend | Out-Null
Start-Sleep -Seconds 1
Start-Frontend
Start-Sleep -Seconds 1
Start-Agents

# 3. 完成结算
Write-Host ""
Write-Host "=== 🎯 系统已就绪 ===" -ForegroundColor Magenta
Write-Host "  ✨ [ 前端控制台 ] -> http://127.0.0.1:$FrontendPort" -ForegroundColor Green
Write-Host "  ✨ [ 后端 API 根地址 ] -> http://127.0.0.1:$BackendPort" -ForegroundColor Green
Write-Host "  ✨ [ Swagger 接口文档 ] -> http://127.0.0.1:$BackendPort/docs" -ForegroundColor Green
if ($StartAgents) {
    Write-Host "  ✨ [ Code Review Agent ] -> http://127.0.0.1:8001/health" -ForegroundColor Green
    Write-Host "  ✨ [ Deep Research Agent ] -> http://127.0.0.1:8002/health" -ForegroundColor Green
    Write-Host "  ✨ [ News Agent ] -> http://127.0.0.1:8003/health" -ForegroundColor Green
    Write-Host "  ✨ [ Study Tutor Agent ] -> http://127.0.0.1:8004/health" -ForegroundColor Green
    Write-Host "  ✨ [ Visual Site Agent ] -> http://127.0.0.1:8005/health" -ForegroundColor Green
}
Write-Host ""
Write-Host "祝您开发愉快（代码永无 Bug）！🎉" -ForegroundColor Yellow
Write-Host ""
Read-Host "按下回车键退出这艘母舰..."

