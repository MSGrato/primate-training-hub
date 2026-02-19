#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy-supabase-agent.sh [options]

Options:
  --skip-db-push           Skip "supabase db push"
  --skip-report-chat       Skip deploying "report-chat" function
  --skip-manage-users      Skip deploying "manage-users" function
  -h, --help               Show this help

Notes:
  - Run from the project root.
  - Ensure you already ran:
      supabase login
      supabase link --project-ref <project-ref>
EOF
}

SKIP_DB_PUSH=false
SKIP_REPORT_CHAT=false
SKIP_MANAGE_USERS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-db-push)
      SKIP_DB_PUSH=true
      shift
      ;;
    --skip-report-chat)
      SKIP_REPORT_CHAT=true
      shift
      ;;
    --skip-manage-users)
      SKIP_MANAGE_USERS=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: Supabase CLI is not installed or not in PATH." >&2
  exit 1
fi

if [[ ! -f "supabase/config.toml" ]]; then
  echo "Error: Run this script from the project root (missing supabase/config.toml)." >&2
  exit 1
fi

if [[ "$SKIP_DB_PUSH" == false ]]; then
  echo "==> Applying database migrations (supabase db push)"
  supabase db push
else
  echo "==> Skipping database migrations"
fi

if [[ "$SKIP_REPORT_CHAT" == false ]]; then
  echo "==> Deploying report-chat function"
  supabase functions deploy report-chat
else
  echo "==> Skipping report-chat deployment"
fi

if [[ "$SKIP_MANAGE_USERS" == false ]]; then
  echo "==> Deploying manage-users function"
  supabase functions deploy manage-users
else
  echo "==> Skipping manage-users deployment"
fi

echo "==> Done"
