#!/usr/bin/env bash

# ======================================================
# FlankerStudySolo 全栈本地开发启动脚本 (Linux)
# ======================================================
# 1. 自动检测并清理后端(2038)和前端(2037)端口占用。
# 2. 自动选择可用的 Python 3 创建虚拟环境并启动 Uvicorn。
# 3. 自动清理前端 .next 缓存并启动 Next.js dev 服务。
# 4. 使用项目专属锁文件和日志文件，避免与其他 StudySolo 项目互相影响。
#
# 用法:
#   ./scripts/start-studysolo.sh [BackendPort] [FrontendPort]

set +e

BackendPort="${1:-2038}"
FrontendPort="${2:-2037}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ProjectDir="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ProjectDir/backend"
FRONTEND_DIR="$ProjectDir/frontend"
PROJECT_SLUG="flankerstudysolo"

C_RESET='\033[0m'
C_CYAN='\033[36m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_GRAY='\033[90m'
C_MAGENTA='\033[35m'

BACKGROUND_BACKEND_LOG="/tmp/${PROJECT_SLUG}-backend.log"
BACKGROUND_FRONTEND_LOG="/tmp/${PROJECT_SLUG}-frontend.log"
LOCK_DIR="/tmp/${PROJECT_SLUG}-start.lock"
STARTED_BACKEND=0
STARTED_FRONTEND=0
BOOTSTRAPPED_BACKEND_ONLY=0

detect_python_for_backend() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s\n' "python3"
    return 0
  fi

  if command -v python >/dev/null 2>&1; then
    local major_version
    major_version="$(python -c 'import sys; print(sys.version_info[0])' 2>/dev/null)"
    if [ "$major_version" = "3" ]; then
      printf '%s\n' "python"
      return 0
    fi
  fi

  return 1
}

python_supports_venv() {
  local python_cmd="$1"
  [ -n "$python_cmd" ] || return 1
  "$python_cmd" -m venv --help >/dev/null 2>&1
}

show_banner() {
  clear
  cat <<'BANNER'

    ███████╗██╗      █████╗ ███╗   ██╗██╗  ██╗███████╗██████╗
    ██╔════╝██║     ██╔══██╗████╗  ██║██║ ██╔╝██╔════╝██╔══██╗
    █████╗  ██║     ███████║██╔██╗ ██║█████╔╝ █████╗  ██████╔╝
    ██╔══╝  ██║     ██╔══██║██║╚██╗██║██╔═██╗ ██╔══╝  ██╔══██╗
    ██║     ███████╗██║  ██║██║ ╚████║██║  ██╗███████╗██║  ██║
    ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝

     ███████╗████████╗██╗   ██╗██████╗ ██╗   ██╗███████╗ ██████╗ ██╗      ██████╗
     ██╔════╝╚══██╔══╝██║   ██║██╔══██╗╚██╗ ██╔╝██╔════╝██╔═══██╗██║     ██╔═══██╗
     ███████╗   ██║   ██║   ██║██║  ██║ ╚████╔╝ ███████╗██║   ██║██║     ██║   ██║
     ╚════██║   ██║   ██║   ██║██║  ██║  ╚██╔╝  ╚════██║██║   ██║██║     ██║   ██║
     ███████║   ██║   ╚██████╔╝██████╔╝   ██║   ███████║╚██████╔╝███████╗╚██████╔╝
     ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝   ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝

BANNER
  printf "${C_GRAY}    [ FlankerStudySolo Linux 启动器 v1.0 ]${C_RESET}\n"
  printf "${C_GRAY}    ---------------------------------------------------------------${C_RESET}\n\n"
}

write_info() {
  printf "${C_CYAN}[ INFO ] %s${C_RESET}\n" "$1"
}

write_success() {
  printf "${C_GREEN}[ OK ] %s${C_RESET}\n" "$1"
}

write_warning() {
  printf "${C_YELLOW}[ WARN ] %s${C_RESET}\n" "$1"
}

write_error_msg() {
  printf "${C_RED}[ ERR ] %s${C_RESET}\n" "$1"
}

acquire_lock() {
  if mkdir "$LOCK_DIR" >/dev/null 2>&1; then
    printf '%s\n' "$$" >"$LOCK_DIR/pid"
    trap cleanup_on_exit EXIT INT TERM
    return 0
  fi

  local existing_pid=""
  if [ -f "$LOCK_DIR/pid" ]; then
    existing_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null)"
  fi

  if [ -n "$existing_pid" ] && kill -0 "$existing_pid" >/dev/null 2>&1; then
    write_error_msg "已有 FlankerStudySolo 启动脚本正在运行 (PID: $existing_pid)。"
    return 1
  fi

  rm -rf "$LOCK_DIR" >/dev/null 2>&1
  if mkdir "$LOCK_DIR" >/dev/null 2>&1; then
    printf '%s\n' "$$" >"$LOCK_DIR/pid"
    trap cleanup_on_exit EXIT INT TERM
    return 0
  fi

  write_error_msg "无法获取 FlankerStudySolo 启动锁，请稍后重试。"
  return 1
}

release_lock() {
  if [ -d "$LOCK_DIR" ] && [ "$(cat "$LOCK_DIR/pid" 2>/dev/null)" = "$$" ]; then
    rm -rf "$LOCK_DIR" >/dev/null 2>&1
  fi
}

cleanup_on_exit() {
  if [ "$STARTED_FRONTEND" -eq 1 ]; then
    write_info "正在关闭前端服务..."
    test_and_kill_port "$FrontendPort" "Frontend" >/dev/null 2>&1
    cleanup_stale_frontend_processes >/dev/null 2>&1
  fi

  if [ "$STARTED_BACKEND" -eq 1 ]; then
    write_info "正在关闭后端服务..."
    test_and_kill_port "$BackendPort" "Backend" >/dev/null 2>&1
    kill_matching_processes "$BACKEND_DIR/.*/uvicorn app.main:app" "后端 Uvicorn 进程" >/dev/null 2>&1
  fi

  release_lock
}

show_spinner() {
  local duration="$1"
  local message="$2"
  local spinner='|/-\'
  local i=0
  local end_time=$((SECONDS + duration))

  while [ "$SECONDS" -lt "$end_time" ]; do
    local c="${spinner:i%4:1}"
    printf "\r${C_CYAN}[ %s ] %s... ${C_RESET}" "$c" "$message"
    sleep 0.1
    i=$((i + 1))
  done
  printf "\r${C_GREEN}[ OK ] %s... 完成！    ${C_RESET}\n" "$message"
}

open_in_new_terminal() {
  local cmd="$1"

  if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
    return 1
  fi

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal -- bash -lc "$cmd; exec bash" >/dev/null 2>&1 && return 0
  fi
  if command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -e bash -lc "$cmd; exec bash" >/dev/null 2>&1 && return 0
  fi
  if command -v konsole >/dev/null 2>&1; then
    konsole --noclose -e bash -lc "$cmd" >/dev/null 2>&1 && return 0
  fi
  if command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal --hold -e "bash -lc '$cmd'" >/dev/null 2>&1 && return 0
  fi
  if command -v alacritty >/dev/null 2>&1; then
    alacritty -e bash -lc "$cmd" >/dev/null 2>&1 && return 0
  fi
  if command -v xterm >/dev/null 2>&1; then
    xterm -hold -e "bash -lc '$cmd'" >/dev/null 2>&1 && return 0
  fi

  return 1
}

is_port_listening() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk -v p=":$port" '$4 ~ p {found=1} END {exit(found ? 0 : 1)}'
    return $?
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  return 1
}

wait_for_port() {
  local port="$1"
  local retries="${2:-30}"
  local interval="${3:-0.2}"
  local i

  for ((i = 1; i <= retries; i++)); do
    if is_port_listening "$port"; then
      return 0
    fi
    sleep "$interval"
  done

  return 1
}

is_process_alive() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1
}

wait_for_process_alive() {
  local pid="$1"
  local retries="${2:-10}"
  local interval="${3:-0.2}"
  local i

  for ((i = 1; i <= retries; i++)); do
    if is_process_alive "$pid"; then
      return 0
    fi
    sleep "$interval"
  done

  return 1
}

kill_pid_gracefully() {
  local pid="$1"
  local name
  name="$(ps -p "$pid" -o comm= 2>/dev/null)"
  if [ -n "$name" ]; then
    printf "${C_GRAY}      -> 终止占用进程: %s (PID: %s)${C_RESET}\n" "$name" "$pid"
  fi
  kill -9 "$pid" >/dev/null 2>&1
  write_success "已释放 PID: $pid"
}

list_port_owners() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p'
  fi
}

test_and_kill_port() {
  local port="$1"
  local service_name="$2"

  write_info "正在检查 $service_name 端口 ($port)..."

  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u)"
  elif command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser -n tcp "$port" 2>/dev/null | tr ' ' '\n' | sed '/^$/d' | sort -u)"
  fi

  if [ -n "$pids" ]; then
    write_warning "发现 $service_name 端口 ($port) 被占用。"
    list_port_owners "$port" | sed 's/^/      /'

    while IFS= read -r pid; do
      [ -z "$pid" ] && continue
      kill_pid_gracefully "$pid"
    done <<< "$pids"
    sleep 1
  fi

  if is_port_listening "$port"; then
    write_error_msg "$service_name 端口 ($port) 清理失败，仍被占用。"
    list_port_owners "$port" | sed 's/^/      /'
    return 1
  fi

  write_success "$service_name 端口 ($port) 已可用。"
  return 0
}

kill_matching_processes() {
  local pattern="$1"
  local description="$2"
  local pids=""

  if command -v pgrep >/dev/null 2>&1; then
    pids="$(pgrep -f "$pattern" 2>/dev/null | sort -u)"
  else
    pids="$(ps -ef | grep -E "$pattern" | grep -v grep | awk '{print $2}' | sort -u)"
  fi

  if [ -z "$pids" ]; then
    write_success "未发现残留$description。"
    return
  fi

  write_warning "发现残留$description，开始清理..."
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    kill_pid_gracefully "$pid"
  done <<< "$pids"
  sleep 1
}

cleanup_stale_frontend_processes() {
  write_info "正在清理残留前端开发进程..."
  kill_matching_processes "$FRONTEND_DIR/.*/next dev" " Next.js dev 进程"
  kill_matching_processes "$FRONTEND_DIR/node_modules/.*/next/dist/bin/next dev" " Next.js CLI 进程"
  kill_matching_processes "next-server \\(v[0-9]" " Next.js 服务进程"
  kill_matching_processes "$FRONTEND_DIR.*pnpm dev" " pnpm 前端包装进程"
  kill_matching_processes "$FRONTEND_DIR.*pnpm exec next dev" " pnpm exec 前端包装进程"
}

start_backend() {
  if [ ! -d "$BACKEND_DIR" ]; then
    write_error_msg "找不到后端目录: $BACKEND_DIR"
    return 1
  fi

  if [ ! -f "$BACKEND_DIR/requirements.txt" ]; then
    write_error_msg "找不到后端依赖文件: $BACKEND_DIR/requirements.txt"
    return 1
  fi

  write_info "正在启动 FlankerStudySolo 后端服务 (FastAPI)..."

  local venv_path="$BACKEND_DIR/.venv"
  local python_cmd=""
  python_cmd="$(detect_python_for_backend)"

  if [ -z "$python_cmd" ]; then
    write_error_msg "未找到可用的 Python 3 解释器。"
    write_warning "请先安装 python3，然后重新运行脚本。"
    return 1
  fi

  if ! python_supports_venv "$python_cmd"; then
    write_error_msg "$python_cmd 不支持 venv 模块。"
    write_warning "请安装 python3-venv（Debian/Ubuntu）或对应发行版的 venv 包后重试。"
    return 1
  fi

  if [ ! -d "$venv_path" ]; then
    write_warning "未检测到后端虚拟环境，准备使用 $python_cmd 创建 .venv ..."

    local setup_cmd="cd '$BACKEND_DIR'"
    setup_cmd+=" && $python_cmd -m venv .venv"
    setup_cmd+=" && source .venv/bin/activate"
    setup_cmd+=" && python -m pip install --upgrade pip"
    setup_cmd+=" && pip install -r requirements.txt"
    setup_cmd+="; echo ''"
    setup_cmd+="; echo '=============================='"
    setup_cmd+="; echo '  FlankerStudySolo 虚拟环境创建完成，依赖已安装'"
    setup_cmd+="; echo '  请重新运行 scripts/start-studysolo.sh'"
    setup_cmd+="; echo '=============================='"
    setup_cmd+="; read -rp '按回车键关闭此窗口' _"

    if ! open_in_new_terminal "$setup_cmd"; then
      write_warning "未检测到图形终端，改为当前终端直接创建虚拟环境..."
      (cd "$BACKEND_DIR" && "$python_cmd" -m venv .venv && source .venv/bin/activate && python -m pip install --upgrade pip && pip install -r requirements.txt)
      if [ $? -eq 0 ]; then
        write_success "虚拟环境创建完成，依赖已安装。"
        write_warning "请重新运行脚本以启动全部服务。"
        BOOTSTRAPPED_BACKEND_ONLY=1
      else
        write_error_msg "虚拟环境创建或依赖安装失败，请检查输出。"
        return 1
      fi
    else
      write_warning "后端环境正在准备中，完成后请重新运行脚本。"
      BOOTSTRAPPED_BACKEND_ONLY=1
    fi

    return 0
  fi

  local cmd="cd '$BACKEND_DIR' && source .venv/bin/activate && uvicorn app.main:app --reload --port $BackendPort --host 0.0.0.0"
  write_info "后台启动后端服务，日志: $BACKGROUND_BACKEND_LOG"
  nohup bash -lc "$cmd" >"$BACKGROUND_BACKEND_LOG" 2>&1 &
  local backend_pid=$!

  if ! wait_for_process_alive "$backend_pid" 10 0.2; then
    write_error_msg "后端启动失败：进程未能存活。"
    write_warning "请检查日志: $BACKGROUND_BACKEND_LOG"
    return 1
  fi

  if wait_for_port "$BackendPort" 60 0.5; then
    STARTED_BACKEND=1
    write_success "后端服务已启动。"
    return 0
  fi

  write_error_msg "后端启动失败：端口 $BackendPort 未在预期时间内就绪。"
  write_warning "请检查日志: $BACKGROUND_BACKEND_LOG"
  return 1
}

start_frontend() {
  if [ ! -d "$FRONTEND_DIR" ]; then
    write_error_msg "找不到前端目录: $FRONTEND_DIR"
    return 1
  fi

  write_info "正在启动 FlankerStudySolo 前端服务 (Next.js)..."

  local next_cache_dir="$FRONTEND_DIR/.next"
  if [ -d "$next_cache_dir" ]; then
    write_info "清理前端 .next 缓存..."
    rm -rf "$next_cache_dir"
    write_success ".next 缓存已清理。"
  fi

  local cmd="cd '$FRONTEND_DIR' && pnpm exec next dev --webpack --hostname 0.0.0.0 --port $FrontendPort"
  write_info "后台启动前端服务，日志: $BACKGROUND_FRONTEND_LOG"
  nohup bash -lc "$cmd" >"$BACKGROUND_FRONTEND_LOG" 2>&1 &
  local frontend_pid=$!

  if ! wait_for_process_alive "$frontend_pid" 10 0.2; then
    write_error_msg "前端启动失败：进程未能存活。"
    write_warning "请检查日志: $BACKGROUND_FRONTEND_LOG"
    return 1
  fi

  if wait_for_port "$FrontendPort" 60 0.5; then
    STARTED_FRONTEND=1
    write_success "前端服务已启动。"
    return 0
  fi

  write_error_msg "前端启动失败：端口 $FrontendPort 未在预期时间内就绪。"
  write_warning "请检查日志: $BACKGROUND_FRONTEND_LOG"
  return 1
}

show_banner

if [ ! -d "$ProjectDir" ]; then
  write_error_msg "项目路径不存在: $ProjectDir"
  read -rp "按回车键退出..." _
  exit 1
fi

if ! acquire_lock; then
  exit 1
fi

show_spinner 1 "初始化 FlankerStudySolo 启动环境"

printf "\n"
printf "${C_MAGENTA}=== 资源检查 ===${C_RESET}\n"
cleanup_stale_frontend_processes
if ! test_and_kill_port "$BackendPort" "Backend"; then
  exit 1
fi
if ! test_and_kill_port "$FrontendPort" "Frontend"; then
  exit 1
fi

show_spinner 1 "准备启动前后端服务"

printf "\n"
printf "${C_MAGENTA}=== 服务启动 ===${C_RESET}\n"
if ! start_backend; then
  exit 1
fi
if [ "$BOOTSTRAPPED_BACKEND_ONLY" -eq 1 ]; then
  printf "\n"
  printf "${C_YELLOW}后端环境刚刚初始化完成，当前不会继续启动前端。${C_RESET}\n"
  printf "${C_YELLOW}请重新运行一次脚本，届时会正式启动后端和前端服务。${C_RESET}\n"
  exit 0
fi
sleep 1
if ! start_frontend; then
  exit 1
fi

printf "\n"
printf "${C_MAGENTA}=== 启动完成 ===${C_RESET}\n"
printf "${C_GREEN}  前端: http://127.0.0.1:%s${C_RESET}\n" "$FrontendPort"
printf "${C_GREEN}  后端: http://127.0.0.1:%s${C_RESET}\n" "$BackendPort"
printf "${C_GREEN}  文档: http://127.0.0.1:%s/docs${C_RESET}\n" "$BackendPort"
printf "${C_GRAY}  后端日志: %s${C_RESET}\n" "$BACKGROUND_BACKEND_LOG"
printf "${C_GRAY}  前端日志: %s${C_RESET}\n" "$BACKGROUND_FRONTEND_LOG"
printf "\n"
read -rp "按回车键退出脚本，并停止本次启动的服务..." _
