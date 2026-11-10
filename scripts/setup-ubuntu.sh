#!/usr/bin/env bash
# ApproveIt setup + run script for Ubuntu 22.04 / 24.04 (a laptop or an AWS EC2 instance).
#
#   bash scripts/setup-ubuntu.sh [options]
#
# Steps (numbered in the output and in the log file):
#   1. check / install git, curl and Node.js 22.18+ (NodeSource)
#   2. pull the branch (default: main)
#   3. install npm dependencies
#   4. prepare .env (EkLink + app URLs, session secret) and validate it
#   5. prod only: build (next build)
#   6. run:  dev  -> `next dev` in this terminal          http://localhost:3002
#            prod -> systemd service on 127.0.0.1:3002 + Nginx on the public port (8002)
#
# Options:
#   --branch NAME        branch to pull (default: main)
#   --skip-pull          do not fetch / checkout / pull (use the code as it is)
#   --mode dev|prod      dev server (default) or production build + systemd + Nginx
#   --public-host HOST   public IP or DNS name of this server, or "auto" (EC2 metadata).
#                        Sets APP_URL / EKLINK_REDIRECT_URI to http://HOST:PORT and, unless
#                        --eklink-url is given, EKLINK_URL / EKLINK_ISSUER to http://HOST
#   --public-port N      public Nginx port for ApproveIt in prod mode (default: 8002)
#   --eklink-url URL     EkLink address (EKLINK_URL + EKLINK_ISSUER), e.g. http://1.2.3.4
#   --reinstall          force a clean `npm ci` even if node_modules looks current
#   --no-run             set everything up, do not start
#   --run-only           skip setup, only start (needs a previous setup)
#   --check              diagnose only (tools, .env keys, ports, service); changes nothing
#   --debug              trace every command with line numbers (the log may then contain secrets)
#   -y, --yes            answer yes to every prompt (non-interactive)
#   -h, --help           show this help
#
# Log file: <repo>/logs/approveit-setup-ubuntu-<time>.log  (or $PBL_LOG_DIR when set)
# On failure it prints the step, line, failing command, exit code and the log path.

# Everything lives in main() so bash has read the whole file before `git pull`
# can change it on disk.
main() {
  set -Eeuo pipefail

  # ---------------- project settings ----------------
  local PROJECT="ApproveIt" SERVICE="approveit"
  local REPO_URL="https://github.com/Rudrakshi2006/Approve_It.git"
  local APP_PORT=3002 PUBLIC_PORT=8002
  local REQUIRED_KEYS=(EKLINK_URL EKLINK_ISSUER EKLINK_CLIENT_ID EKLINK_CLIENT_SECRET EKLINK_REDIRECT_URI
                       APP_URL APP_SESSION_SECRET SUPABASE_URL SUPABASE_SECRET_KEY)

  # ---------------- options ----------------
  local BRANCH="main" SKIP_PULL=0 MODE="dev" PUBLIC_HOST="" NO_RUN=0 RUN_ONLY=0
  local CHECK_ONLY=0 DEBUG=0 ASSUME_YES=0 REINSTALL=0 EKLINK_URL_ARG=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --branch) BRANCH="${2:?--branch needs a value}"; shift ;;
      --skip-pull) SKIP_PULL=1 ;;
      --mode) MODE="${2:?--mode needs dev or prod}"; shift ;;
      --public-host) PUBLIC_HOST="${2:?--public-host needs a value}"; shift ;;
      --public-port) PUBLIC_PORT="${2:?--public-port needs a value}"; shift ;;
      --eklink-url) EKLINK_URL_ARG="${2:?--eklink-url needs a value}"; shift ;;
      --reinstall) REINSTALL=1 ;;
      --no-run) NO_RUN=1 ;;
      --run-only) RUN_ONLY=1 ;;
      --check) CHECK_ONLY=1 ;;
      --debug) DEBUG=1 ;;
      -y|--yes) ASSUME_YES=1 ;;
      -h|--help) awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}"; return 0 ;;
      *) echo "Unknown option: $1 (see --help)" >&2; return 2 ;;
    esac
    shift
  done
  case "$MODE" in dev|prod) ;; *) echo "--mode must be dev or prod" >&2; return 2 ;; esac
  case "$PUBLIC_PORT" in ''|*[!0-9]*) echo "--public-port must be a number" >&2; return 2 ;; esac
  if [ "$NO_RUN" = 1 ] && [ "$RUN_ONLY" = 1 ]; then echo "--no-run and --run-only cannot be combined" >&2; return 2; fi

  # ---------------- logging + error reporting ----------------
  local SCRIPT_DIR; SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local LOG_DIR="${PBL_LOG_DIR:-$SCRIPT_DIR/../logs}"
  mkdir -p "$LOG_DIR" 2>/dev/null || LOG_DIR="${TMPDIR:-/tmp}/pbl-logs"
  mkdir -p "$LOG_DIR"; LOG_DIR="$(cd "$LOG_DIR" && pwd)"
  LOG_FILE="$LOG_DIR/${SERVICE}-setup-ubuntu-$(date +%Y%m%d-%H%M%S).log"
  if [ -t 1 ]; then C_STEP=$'\033[1;36m'; C_WARN=$'\033[1;33m'; C_ERR=$'\033[1;31m'; C_OK=$'\033[1;32m'; C_END=$'\033[0m'
  else C_STEP=""; C_WARN=""; C_ERR=""; C_OK=""; C_END=""; fi
  exec > >(tee -a "$LOG_FILE") 2>&1

  CURRENT_STEP="0. start"; STEP_NO=0
  on_error() {  # on_error <exit code> <line> <command>
    [ "${BASH_SUBSHELL:-0}" -eq 0 ] || return 0   # report once, from the main shell
    printf '\n%s[x] %s failed in step "%s"%s\n' "$C_ERR" "$PROJECT" "$CURRENT_STEP" "$C_END" >&2
    printf '    line %s: %s\n    exit code: %s   (functions: %s)\n' "$2" "$3" "$1" "${FUNCNAME[*]:1}" >&2
    printf '    full log: %s\n' "$LOG_FILE" >&2
    printf '    next: re-run with --debug to trace every command, or --check to diagnose.\n' >&2
  }
  trap 'rc=$?; on_error "$rc" "$LINENO" "$BASH_COMMAND"' ERR
  if [ "$DEBUG" = 1 ]; then export PS4='+ [line ${LINENO}] '; set -x; fi

  step() { STEP_NO=$((STEP_NO + 1)); CURRENT_STEP="$STEP_NO. $*"; printf '\n%s==> [%s] %s%s\n' "$C_STEP" "$STEP_NO" "$*" "$C_END"; }
  info() { printf '    %s\n' "$*"; }
  ok()   { printf '    %s[ok]%s %s\n' "$C_OK" "$C_END" "$*"; }
  warn() { printf '%s[!] %s%s\n' "$C_WARN" "$*" "$C_END"; }
  die()  { printf '%s[x] %s%s\n    step: %s\n    log:  %s\n' "$C_ERR" "$*" "$C_END" "$CURRENT_STEP" "$LOG_FILE" >&2; exit 1; }
  have() { command -v "$1" >/dev/null 2>&1; }
  confirm() {  # confirm "question" -> 0 yes / 1 no (default yes)
    [ "$ASSUME_YES" = 1 ] && return 0
    [ -t 0 ] || return 1   # no keyboard and no --yes: never install anything unattended
    local reply; read -r -p "    $1 [Y/n] " reply || true
    case "$reply" in [nN]*) return 1 ;; *) return 0 ;; esac
  }
  retry() {  # retry <attempts> <command...>: for network steps (apt, npm, git)
    local max=$1 n=1; shift
    until "$@"; do
      if [ "$n" -ge "$max" ]; then return 1; fi
      warn "Attempt $n/$max failed: $*  (retrying in $((n * 5))s)"
      sleep $((n * 5)); n=$((n + 1))
    done
  }
  port_busy() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }
  wait_http() {  # wait_http <url> <seconds>: 0 when it answers with any non-5xx status
    local url=$1 limit=$2 waited=0 code
    while [ "$waited" -lt "$limit" ]; do
      code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$url" 2>/dev/null || true)"
      case "$code" in 2??|3??|4??) return 0 ;; esac
      sleep 3; waited=$((waited + 3))
    done
    return 1
  }

  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  info "$PROJECT setup (ubuntu) | mode=$MODE branch=$BRANCH | log: $LOG_FILE"
  [ "$(id -u)" -eq 0 ] && warn "Running as root. Prefer a normal user with sudo (e.g. 'ubuntu' on EC2) so files are not owned by root."

  # ---------------- .env helpers (Node.js does the parsing) ----------------
  ENV_FILE=".env"; ENV_BACKED_UP=0
  env_get() {  # env_get KEY -> value ('' when missing); strips surrounding quotes
    node - "$ENV_FILE" "$1" <<'JS'
const fs = require("fs");
const [file, key] = process.argv.slice(2);
if (!fs.existsSync(file)) process.exit(0);
for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
  if (m && m[1] === key) {
    let v = m[2].trim();
    if (v.length > 1 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) v = v.slice(1, -1);
    process.stdout.write(v);
    break;
  }
}
JS
  }
  env_set() {  # env_set KEY VALUE: replaces the first KEY= line or appends; backs .env up once per run
    if [ "$ENV_BACKED_UP" = 0 ] && [ -f "$ENV_FILE" ]; then
      local bak; bak="$LOG_DIR/${SERVICE}.env.$(date +%Y%m%d-%H%M%S).bak"
      cp "$ENV_FILE" "$bak" && chmod 600 "$bak" && info "Backed up $ENV_FILE -> $bak"
      ENV_BACKED_UP=1
    fi
    node - "$ENV_FILE" "$1" "$2" <<'JS'
const fs = require("fs");
const [file, key, value] = process.argv.slice(2);
const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
while (lines.length && lines[lines.length - 1] === "") lines.pop();
const re = new RegExp("^\\s*(?:export\\s+)?" + key + "\\s*=");
const i = lines.findIndex((l) => re.test(l));
if (i >= 0) lines[i] = key + "=" + value; else lines.push(key + "=" + value);
fs.writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });
JS
  }
  missing_keys() {  # prints the REQUIRED_KEYS that are empty in .env
    local k
    for k in "${REQUIRED_KEYS[@]}"; do [ -n "$(env_get "$k")" ] || echo "$k"; done
  }
  detect_public_ip() {  # EC2 metadata (IMDSv2), then a public echo service
    local token ip=""
    token="$(curl -fsS -m 2 -X PUT http://169.254.169.254/latest/api/token \
      -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' 2>/dev/null || true)"
    if [ -n "$token" ]; then
      ip="$(curl -fsS -m 2 -H "X-aws-ec2-metadata-token: $token" \
        http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
    fi
    [ -n "$ip" ] || ip="$(curl -fsS -m 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)"
    printf '%s' "$ip"
  }
  public_url() {  # public_url HOST PORT -> http://HOST or http://HOST:PORT
    if [ "$2" = 80 ]; then printf 'http://%s' "$1"; else printf 'http://%s:%s' "$1" "$2"; fi
  }

  if [ "$PUBLIC_HOST" = "auto" ]; then
    PUBLIC_HOST="$(detect_public_ip)"
    [ -n "$PUBLIC_HOST" ] || die "Could not detect the public IP. Pass it yourself: --public-host 1.2.3.4"
    info "Detected public host: $PUBLIC_HOST"
  fi

  # ---------------- repository location ----------------
  local ROOT=""
  ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"

  # ---------------- --check: diagnose only ----------------
  if [ "$CHECK_ONLY" = 1 ]; then
    step "Diagnosis (nothing is changed)"
    local problems=0
    bad() { printf '    %s[problem]%s %s\n' "$C_ERR" "$C_END" "$*"; problems=$((problems + 1)); }
    if [ -r /etc/os-release ]; then . /etc/os-release; info "OS: ${PRETTY_NAME:-?}  user: $(id -un)"; fi
    have git && ok "git $(git --version | awk '{print $3}')" || bad "git is not installed"
    have curl && ok "curl installed" || bad "curl is not installed"
    if have node; then
      node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)' \
        && ok "node $(node --version), npm $(npm --version)" || bad "node $(node --version) is too old (need 22.18+)"
    else bad "Node.js is not installed"; fi
    if [ -n "$ROOT" ]; then
      ok "repository: $ROOT (branch $(git -C "$ROOT" rev-parse --abbrev-ref HEAD))"
      [ -z "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ] && ok "no uncommitted changes" \
        || warn "uncommitted changes (a pull will refuse; use --skip-pull)"
      cd "$ROOT"
      [ -d node_modules ] && ok "node_modules present" || bad "node_modules missing (run without --check)"
      [ -f .env ] || { [ -f .env.local ] && ENV_FILE=".env.local"; }
      if [ -f "$ENV_FILE" ] && have node; then
        ok "$ENV_FILE present"
        local miss; miss="$(missing_keys | tr '\n' ' ')"
        [ -z "$miss" ] && ok "all required keys set" || bad "empty keys in $ENV_FILE: $miss"
        local sb; sb="$(env_get SUPABASE_URL)"
        if [ -n "$sb" ]; then
          local code; code="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$sb/auth/v1/health" || true)"
          case "$code" in 2??|401) ok "Supabase reachable ($sb, HTTP $code)" ;; *) bad "Supabase not reachable ($sb, HTTP ${code:-none})" ;; esac
        fi
        info "APP_URL=$(env_get APP_URL)  EKLINK_URL=$(env_get EKLINK_URL)  EKLINK_REDIRECT_URI=$(env_get EKLINK_REDIRECT_URI)"
        local ek; ek="$(env_get EKLINK_URL)"
        if [ -n "$ek" ]; then
          local ekc; ekc="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$ek/" || true)"
          case "$ekc" in 2??|3??|4??) ok "EkLink reachable ($ek, HTTP $ekc)" ;; *) bad "EkLink not reachable at $ek (HTTP ${ekc:-none}); sign-in needs it" ;; esac
        fi
      else bad "no .env file (copy .env.example to .env)"; fi
    else
      bad "not inside the $PROJECT git repository ($SCRIPT_DIR)"
    fi
    if port_busy "$APP_PORT"; then info "port $APP_PORT is in use:"; ss -ltnpH "sport = :$APP_PORT" 2>/dev/null | sed 's/^/      /' || true
    else info "port $APP_PORT is free"; fi
    if have systemctl && systemctl list-unit-files "$SERVICE.service" >/dev/null 2>&1 \
       && systemctl cat "$SERVICE.service" >/dev/null 2>&1; then
      info "systemd $SERVICE.service: $(systemctl is-active "$SERVICE" 2>/dev/null || true)  (logs: journalctl -u $SERVICE -n 100)"
    fi
    have nginx && info "nginx: $(nginx -v 2>&1 | awk -F/ '{print $2}'), $(systemctl is-active nginx 2>/dev/null || true)"
    info "memory: $(free -m | awk '/^Mem:/{print $2" MB RAM"} /^Swap:/{print $2" MB swap"}' | tr '\n' ' ')  disk free: $(df -Pm . | awk 'NR==2{print $4" MB"}')"
    if [ "$problems" -eq 0 ]; then printf '\n%sNo problems found.%s\n' "$C_OK" "$C_END"; return 0; fi
    printf '\n%s%s problem(s) found (see above).%s\n' "$C_ERR" "$problems" "$C_END"; return 1
  fi

  # ---------------- 1. tools ----------------
  local apt_updated=0
  apt_install() {
    if [ "$apt_updated" = 0 ]; then
      retry 3 $SUDO apt-get -o DPkg::Lock::Timeout=300 update -y || die "apt-get update failed (network? another apt running?)"
      apt_updated=1
    fi
    retry 3 $SUDO env DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=300 install -y "$@" \
      || die "apt-get install $* failed"
  }
  node_ok() { have node && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; }

  if [ "$RUN_ONLY" = 0 ]; then
    step "Checking required software"
    if [ -r /etc/os-release ]; then . /etc/os-release; info "OS: ${PRETTY_NAME:-unknown}"; fi
    have apt-get || die "apt-get not found: this script is for Ubuntu/Debian. See README.md for the manual steps."
    if ! have git || ! have curl || ! have ss; then
      confirm "Install git, curl and iproute2 with apt?" || die "git and curl are required."
      apt_install git curl ca-certificates gnupg iproute2
    fi
    if ! node_ok; then
      confirm "Node.js 22.18+ not found. Install Node.js 24 LTS from NodeSource?" || die "Node.js 22.18+ is required."
      local ns; ns="$(mktemp)"
      retry 3 curl -fsSL https://deb.nodesource.com/setup_24.x -o "$ns" || die "Could not download the NodeSource setup script."
      ${SUDO:+$SUDO -E} bash "$ns" || die "The NodeSource setup script failed (output above)."
      rm -f "$ns"
      apt_updated=1   # the NodeSource script already ran apt-get update
      apt_install nodejs
      hash -r
      node_ok || die "Node.js install failed ('which node' = $(command -v node || echo none); an older node may be first on PATH)."
    fi
    ok "git $(git --version | awk '{print $3}'), node $(node --version), npm $(npm --version)"
  else
    node_ok || die "Node.js 22.18+ not found; run the full setup first (without --run-only)."
  fi

  # ---------------- 2. repository ----------------
  if [ -z "$ROOT" ]; then
    ROOT="$PWD/$PROJECT"
    if [ -d "$ROOT/.git" ]; then info "Using existing clone: $ROOT"
    elif [ "$RUN_ONLY" = 1 ]; then die "Repository not found at $ROOT."
    else
      step "Cloning $REPO_URL"
      retry 3 git clone --branch "$BRANCH" "$REPO_URL" "$ROOT" || die "git clone failed (network? repository access?)"
    fi
  fi
  cd "$ROOT"
  # keep logs out of `git status` without touching the tracked .gitignore
  if [ -d .git/info ] && ! grep -qx 'logs/' .git/info/exclude 2>/dev/null; then echo 'logs/' >> .git/info/exclude; fi

  if [ "$RUN_ONLY" = 0 ]; then
    step "Getting the code (branch: $BRANCH)"
    info "Repository: $ROOT"
    if [ "$SKIP_PULL" = 0 ]; then
      if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        git status --short --untracked-files=no | sed 's/^/      /'
        die "Uncommitted changes (listed above). Commit or stash them, or re-run with --skip-pull."
      fi
      retry 3 git fetch origin "$BRANCH" || die "git fetch failed (network? does branch '$BRANCH' exist on origin?)"
      if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
        if git show-ref --verify --quiet "refs/heads/$BRANCH"; then git checkout "$BRANCH"
        else git checkout -b "$BRANCH" --track "origin/$BRANCH"; fi
      fi
      git pull --ff-only origin "$BRANCH" || die "git pull --ff-only failed: local branch has diverged from origin/$BRANCH."
      ok "at $(git log -1 --format='%h %s')"
    else
      info "Skipping git pull (--skip-pull). Current: $(git rev-parse --abbrev-ref HEAD) $(git log -1 --format='%h')"
    fi

    # ---------------- 3. dependencies ----------------
    step "Installing npm dependencies"
    if [ "$REINSTALL" = 0 ] && [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
      ok "node_modules is up to date (use --reinstall to force)"
    elif ! retry 2 npm ci --no-audit --no-fund; then
      warn "npm ci failed (package-lock.json out of sync?); trying npm install"
      retry 2 npm install --no-audit --no-fund || die "npm install failed. Check the npm error above (network, disk space, Node version)."
    fi
  fi

  # ---------------- 4. .env ----------------
  [ -f .env ] || { [ -f .env.local ] && ENV_FILE=".env.local"; }
  local PUBLIC_URL=""
  [ -n "$PUBLIC_HOST" ] && PUBLIC_URL="$(public_url "$PUBLIC_HOST" "$PUBLIC_PORT")"
  if [ "$RUN_ONLY" = 0 ]; then
    step "Configuring $ENV_FILE"
    if [ ! -f "$ENV_FILE" ]; then
      [ -f .env.example ] || die ".env.example is missing from the repository."
      cp .env.example "$ENV_FILE"; chmod 600 "$ENV_FILE"; info "Created $ENV_FILE from .env.example"
    fi
    # EkLink address: --eklink-url, else http://<public host> (EkLink on port 80), else localhost
    local EK="$EKLINK_URL_ARG"
    [ -z "$EK" ] && [ -n "$PUBLIC_HOST" ] && EK="http://$PUBLIC_HOST"
    EK="${EK%/}"
    if [ -n "$EK" ]; then
      env_set EKLINK_URL "$EK"; env_set EKLINK_ISSUER "$EK"; info "EKLINK_URL / EKLINK_ISSUER -> $EK"
    else
      [ -n "$(env_get EKLINK_URL)" ] || { env_set EKLINK_URL "http://localhost:3000"; info "EKLINK_URL -> http://localhost:3000"; }
      [ -n "$(env_get EKLINK_ISSUER)" ] || { env_set EKLINK_ISSUER "$(env_get EKLINK_URL)"; info "EKLINK_ISSUER -> $(env_get EKLINK_URL)"; }
    fi
    if [ -n "$PUBLIC_URL" ]; then
      env_set APP_URL "$PUBLIC_URL"; env_set EKLINK_REDIRECT_URI "$PUBLIC_URL/auth/callback"
      info "APP_URL -> $PUBLIC_URL, EKLINK_REDIRECT_URI -> $PUBLIC_URL/auth/callback"
      warn "This callback must be registered in EkLink (setup-all-ubuntu.sh does it):"
      info "  cd ../EkLink && node --env-file=.env scripts/set-app-url.mjs --slug approveit --url $PUBLIC_URL --callback $PUBLIC_URL/auth/callback"
    else
      [ -n "$(env_get APP_URL)" ] || { env_set APP_URL "http://localhost:$APP_PORT"; info "APP_URL -> http://localhost:$APP_PORT"; }
      [ -n "$(env_get EKLINK_REDIRECT_URI)" ] || { env_set EKLINK_REDIRECT_URI "$(env_get APP_URL)/auth/callback"; info "EKLINK_REDIRECT_URI -> $(env_get APP_URL)/auth/callback"; }
    fi
    local sess; sess="$(env_get APP_SESSION_SECRET)"
    if [ "${#sess}" -lt 32 ]; then
      env_set APP_SESSION_SECRET "$(node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64"))')"
      ok "generated APP_SESSION_SECRET (existing ApproveIt sessions are signed out)"
    fi
  fi
  local miss; miss="$(missing_keys | tr '\n' ' ')"
  if [ -n "$miss" ]; then
    die "These keys are empty in $ROOT/$ENV_FILE: $miss
    Fill them in, then re-run. EKLINK_CLIENT_ID / EKLINK_CLIENT_SECRET come from the EkLink admin
    (EkLink: scripts/register-app.mjs --slug approveit). Supabase values: Supabase dashboard ->
    Project Settings -> API (Project URL, secret key)."
  fi
  ok "all required keys are set in $ENV_FILE"
  local sb code; sb="$(env_get SUPABASE_URL)"
  code="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$sb/auth/v1/health" 2>/dev/null || true)"
  case "$code" in 2??|401) ok "Supabase reachable (HTTP $code)" ;;
    *) warn "Supabase did not answer ($sb -> HTTP ${code:-none}). Sign-in will fail until it does." ;; esac

  if [ "$NO_RUN" = 1 ] && [ "$MODE" = "dev" ]; then
    step "Setup complete"
    info "Start it with:  bash scripts/setup-ubuntu.sh --run-only    (or: npm run dev)"
    return 0
  fi

  # ---------------- dev mode: run in this terminal ----------------
  if [ "$MODE" = "dev" ]; then
    step "Starting the dev server (http://localhost:$APP_PORT)"
    if port_busy "$APP_PORT"; then
      ss -ltnpH "sport = :$APP_PORT" 2>/dev/null | sed 's/^/      /' || true
      die "Port $APP_PORT is already in use (listed above). Stop that process (or: sudo systemctl stop $SERVICE) and re-run."
    fi
    info "Press Ctrl+C to stop."
    npm run dev   # package.json already pins -p 3002
    return 0
  fi

  # ---------------- prod mode ----------------
  [ -d /run/systemd/system ] || die "systemd is not running here; --mode prod needs systemd (use --mode dev)."
  local NODE_BIN; NODE_BIN="$(command -v node)"
  local RUN_USER; RUN_USER="$(id -un)"

  if [ "$RUN_ONLY" = 0 ]; then
    step "Building for production (next build)"
    local mem_kb swap_kb
    mem_kb="$(awk '/^MemTotal:/{print $2}' /proc/meminfo)"; swap_kb="$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)"
    info "Memory: $((mem_kb / 1024)) MB RAM + $((swap_kb / 1024)) MB swap; disk free: $(df -Pm . | awk 'NR==2{print $4}') MB"
    if [ $(((mem_kb + swap_kb) / 1024)) -lt 3500 ]; then
      if [ -f /swapfile ]; then
        grep -q '^/swapfile ' /proc/swaps || $SUDO swapon /swapfile || warn "Could not enable /swapfile"
      elif confirm "Less than 3.5 GB RAM+swap: the build may be killed (out of memory). Create a 4 GB /swapfile?"; then
        $SUDO fallocate -l 4G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
        $SUDO chmod 600 /swapfile && $SUDO mkswap /swapfile >/dev/null && $SUDO swapon /swapfile
        grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
        ok "4 GB swap enabled"
      else
        warn "Continuing without extra swap."
      fi
    fi
    if ! NODE_ENV=production npm run build; then
      dmesg 2>/dev/null | grep -qi 'killed process.*node' && warn "The kernel killed node: out of memory. Add swap (see above) and re-run."
      die "next build failed. Read the build error above (missing env value? type error? out of memory?)."
    fi
    ok "build finished"
  fi
  [ -d .next ] || die "No .next build found; run without --run-only first."

  step "Installing the systemd service '$SERVICE' (127.0.0.1:$APP_PORT)"
  $SUDO tee "/etc/systemd/system/$SERVICE.service" >/dev/null <<UNIT
[Unit]
Description=$PROJECT (Next.js, port $APP_PORT)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$ROOT
Environment=NODE_ENV=production
ExecStart=$NODE_BIN $ROOT/node_modules/next/dist/bin/next start -H 127.0.0.1 -p $APP_PORT
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable "$SERVICE" >/dev/null 2>&1
  $SUDO systemctl restart "$SERVICE"
  if ! wait_http "http://127.0.0.1:$APP_PORT/" 90; then
    $SUDO journalctl -u "$SERVICE" -n 60 --no-pager || true
    die "$SERVICE did not answer on 127.0.0.1:$APP_PORT within 90s (service log above)."
  fi
  ok "$SERVICE is running (logs: journalctl -u $SERVICE -f)"

  step "Configuring Nginx (public port $PUBLIC_PORT -> 127.0.0.1:$APP_PORT)"
  if ! have nginx; then apt_install nginx; fi
  local SITE="/etc/nginx/sites-available/pbl-$SERVICE.conf" LINK="/etc/nginx/sites-enabled/pbl-$SERVICE.conf"
  local DEFAULT_REMOVED=0 COOKIE_FIX=""
  # ApproveIt marks its session cookie Secure when NODE_ENV=production. Browsers drop
  # Secure cookies on plain http://<ip>, so sign-in would loop. Until HTTPS is set up,
  # Nginx removes the Secure flag (needs Nginx 1.19.3+; Ubuntu 22.04 ships 1.18).
  local NGX_VER; NGX_VER="$(nginx -v 2>&1 | sed -n 's|.*nginx/\([0-9.]*\).*|\1|p')"
  if [ -n "$NGX_VER" ] && [ "$(printf '%s\n1.19.3\n' "$NGX_VER" | sort -V | head -n1)" = "1.19.3" ]; then
    COOKIE_FIX="    # plain-HTTP deployment: strip Secure from cookies (remove once HTTPS is on)
    proxy_cookie_flags ~ nosecure;"
  else
    warn "Nginx ${NGX_VER:-?} cannot strip the Secure cookie flag (needs 1.19.3+). Over plain HTTP the"
    warn "ApproveIt sign-in will not stick: use Ubuntu 24.04, or put HTTPS in front."
  fi
  $SUDO tee "$SITE" >/dev/null <<NGINX
# Managed by $PROJECT/scripts/setup-ubuntu.sh -- re-running the script overwrites this file.
server {
    listen $PUBLIC_PORT;
    server_name _;
    client_max_body_size 20m;
$COOKIE_FIX

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$http_host;
        proxy_read_timeout 120s;
    }
}
NGINX
  $SUDO ln -sf "$SITE" "$LINK"
  if [ "$PUBLIC_PORT" = 80 ] && [ -e /etc/nginx/sites-enabled/default ]; then
    $SUDO rm -f /etc/nginx/sites-enabled/default; DEFAULT_REMOVED=1
    info "Disabled the stock Nginx 'default' site (it also uses port 80)"
  fi
  if ! $SUDO nginx -t; then
    $SUDO rm -f "$LINK"
    [ "$DEFAULT_REMOVED" = 1 ] && $SUDO ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    die "Nginx rejected the configuration (error above). $SITE was disabled so Nginx keeps working."
  fi
  $SUDO systemctl enable nginx >/dev/null 2>&1 || true
  $SUDO systemctl reload nginx 2>/dev/null || $SUDO systemctl restart nginx
  if have ufw && $SUDO ufw status 2>/dev/null | grep -q '^Status: active'; then
    $SUDO ufw allow "$PUBLIC_PORT/tcp" >/dev/null && info "ufw: allowed port $PUBLIC_PORT/tcp"
  fi
  wait_http "http://127.0.0.1:$PUBLIC_PORT/" 30 || die "Nginx is not answering on port $PUBLIC_PORT (sudo tail /var/log/nginx/error.log)."

  step "Done"
  ok "$PROJECT is running in production mode."
  info "Local:   http://127.0.0.1:$PUBLIC_PORT"
  [ -n "$PUBLIC_URL" ] && info "Public:  $PUBLIC_URL   (EC2: allow inbound TCP $PUBLIC_PORT in the security group)"
  info "Status:  systemctl status $SERVICE     Logs: journalctl -u $SERVICE -f"
  info "Restart: sudo systemctl restart $SERVICE   Stop: sudo systemctl stop $SERVICE"
}

main "$@"
