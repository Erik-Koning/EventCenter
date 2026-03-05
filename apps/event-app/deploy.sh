#!/usr/bin/env bash
set -euo pipefail

# ── Deploy Next.js standalone to Azure Local Git ────────────────
#
# Usage:
#   ./deploy.sh              # interactive, production build
#   ./deploy.sh -y           # auto-confirm all prompts
#   ./deploy.sh --dev        # use dev env (.env) instead of .env.production
#   ./deploy.sh -y --dev     # auto + dev
#
# Requires:
#   AZURE_LOCAL_GIT_REMOTE_URL in .env (app-level) or ../../.env (root)

# ── Parse flags ─────────────────────────────────────────────────
AUTO_YES=false
USE_PROD_ENV=true

for arg in "$@"; do
  case "$arg" in
    -y|--yes)   AUTO_YES=true ;;
    --dev)      USE_PROD_ENV=false ;;
  esac
done

# ── Paths ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

echo "=========================================="
echo "  Next.js Standalone → Azure Local Git"
echo "=========================================="
echo ""
echo "  App dir:   $APP_DIR"
echo "  Repo root: $REPO_ROOT"
echo "  Prod env:  $USE_PROD_ENV"
echo "  Auto mode: $AUTO_YES"

# ── Step 1: Load AZURE_LOCAL_GIT_REMOTE_URL ─────────────────────
echo ""
echo "Step 1: Loading configuration..."

AZURE_URL=""

# Check app-level .env first, then root .env
for envfile in "$APP_DIR/.env" "$APP_DIR/.env.local" "$REPO_ROOT/.env" "$REPO_ROOT/.env.local"; do
  if [ -f "$envfile" ] && [ -z "$AZURE_URL" ]; then
    val=$(grep -E '^AZURE_LOCAL_GIT_REMOTE_URL=' "$envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
    if [ -n "$val" ]; then
      AZURE_URL="$val"
      echo "  Found AZURE_LOCAL_GIT_REMOTE_URL in $envfile"
    fi
  fi
done

# Also check env var directly
if [ -z "$AZURE_URL" ] && [ -n "${AZURE_LOCAL_GIT_REMOTE_URL:-}" ]; then
  AZURE_URL="$AZURE_LOCAL_GIT_REMOTE_URL"
  echo "  Found AZURE_LOCAL_GIT_REMOTE_URL in environment"
fi

# ── Step 2: Build ───────────────────────────────────────────────
echo ""
echo "Step 2: Building Next.js standalone..."

cd "$REPO_ROOT"

if [ "$USE_PROD_ENV" = true ]; then
  echo "  Running: pnpm --filter event-app build:standalone:prod"
  echo "  Env: ../../.env.production + STANDALONE=true"
  pnpm --filter event-app build:standalone:prod
else
  echo "  Running: pnpm --filter event-app build:standalone"
  echo "  Env: ../../.env + STANDALONE=true"
  pnpm --filter event-app build:standalone
fi

# ── Step 3: Locate standalone output ────────────────────────────
echo ""
echo "Step 3: Locating standalone artifact..."

STANDALONE_DIR="$APP_DIR/.next/standalone"

if [ ! -d "$STANDALONE_DIR" ]; then
  echo "ERROR: Standalone directory not found at $STANDALONE_DIR"
  echo "  Make sure next.config has output: 'standalone'"
  exit 1
fi

# In a monorepo, Next.js nests the app under the repo-relative path
# e.g., .next/standalone/apps/event-app/server.js
NESTED_PATH=""

if [ -f "$STANDALONE_DIR/server.js" ]; then
  echo "  Found server.js at standalone root"
elif [ -f "$STANDALONE_DIR/apps/event-app/server.js" ]; then
  NESTED_PATH="apps/event-app"
  echo "  Found server.js at $NESTED_PATH/server.js (monorepo layout)"
else
  # Search for it
  SERVER_JS=$(find "$STANDALONE_DIR" -name "server.js" -maxdepth 4 | head -1)
  if [ -n "$SERVER_JS" ]; then
    NESTED_PATH="${SERVER_JS#$STANDALONE_DIR/}"
    NESTED_PATH="${NESTED_PATH%/server.js}"
    echo "  Found server.js at $NESTED_PATH/server.js"
  else
    echo "ERROR: server.js not found anywhere in $STANDALONE_DIR"
    echo "  Build may have failed or standalone output is misconfigured."
    exit 1
  fi
fi

# ── Step 4: Copy static assets into standalone ──────────────────
echo ""
echo "Step 4: Assembling artifact..."

# Static assets must go alongside server.js
if [ -n "$NESTED_PATH" ]; then
  STATIC_TARGET="$STANDALONE_DIR/$NESTED_PATH"
else
  STATIC_TARGET="$STANDALONE_DIR"
fi

if [ -d "$APP_DIR/.next/static" ]; then
  echo "  Copying .next/static..."
  rm -rf "$STATIC_TARGET/.next/static"
  mkdir -p "$STATIC_TARGET/.next"
  cp -rL "$APP_DIR/.next/static" "$STATIC_TARGET/.next/static"
fi

if [ -d "$APP_DIR/public" ]; then
  echo "  Copying public..."
  rm -rf "$STATIC_TARGET/public"
  cp -rL "$APP_DIR/public" "$STATIC_TARGET/public"
fi

# ── Step 5: Resolve symlinks ────────────────────────────────────
echo ""
echo "Step 5: Checking for symlinks..."

SYMLINK_COUNT=$(find "$STANDALONE_DIR" -type l 2>/dev/null | wc -l | tr -d ' ')

if [ "$SYMLINK_COUNT" -gt 0 ]; then
  echo "  Found $SYMLINK_COUNT symlinks, resolving..."
  find "$STANDALONE_DIR" -type l | while read link; do
    target=$(readlink -f "$link" 2>/dev/null || python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$link")
    linkname=$(basename "$link")
    if [ -e "$target" ]; then
      rm -rf "$link"
      cp -rL "$target" "$link"
      echo "    Resolved: $linkname"
    else
      echo "    Broken symlink removed: $linkname"
      rm -f "$link"
    fi
  done
fi

REMAINING=$(find "$STANDALONE_DIR" -type l 2>/dev/null | wc -l | tr -d ' ')
if [ "$REMAINING" -gt 0 ]; then
  echo "  WARNING: $REMAINING symlinks still remain!"
  find "$STANDALONE_DIR" -type l 2>/dev/null | head -10
  if [ "$AUTO_YES" = false ]; then
    read -p "  Continue anyway? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
      exit 1
    fi
  fi
else
  echo "  No symlinks remain"
fi

FILE_COUNT=$(find "$STANDALONE_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
SIZE=$(du -sh "$STANDALONE_DIR" | cut -f1)
echo "  $FILE_COUNT files, $SIZE total"

# ── Step 6: Git init in standalone dir ──────────────────────────
echo ""
echo "Step 6: Initializing git in standalone artifact..."
cd "$STANDALONE_DIR"

# Always re-init since next build recreates .next/standalone from scratch
rm -rf .git
git init -b master

# ── Step 7: Set up Azure remote ─────────────────────────────────
echo ""
echo "Step 7: Configuring Azure remote..."

if [ -z "$AZURE_URL" ]; then
  if [ "$AUTO_YES" = true ]; then
    echo "ERROR: AZURE_LOCAL_GIT_REMOTE_URL not set in .env and running in auto mode."
    echo "  Add it to $APP_DIR/.env or $REPO_ROOT/.env"
    exit 1
  fi
  echo ""
  echo "AZURE_LOCAL_GIT_REMOTE_URL not found in .env."
  echo ""
  echo "To get your Azure Git URL:"
  echo "  1. Go to Azure Portal > Your App Service > Deployment Center"
  echo "  2. Select 'Local Git' as source"
  echo "  3. Copy the Git Clone URL"
  echo ""
  read -p "Enter your Azure Git URL: " AZURE_URL
  if [ -z "$AZURE_URL" ]; then
    echo "No URL provided. Cannot deploy."
    exit 1
  fi
fi

git remote add azure "$AZURE_URL"
echo "  Remote 'azure' -> $AZURE_URL"

# ── Step 8: Stage, commit, push ─────────────────────────────────
echo ""
echo "Step 8: Deploying..."

# Get current branch name from the source repo
CURRENT_BRANCH=$(cd "$REPO_ROOT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

# Determine startup command based on nesting
if [ -n "$NESTED_PATH" ]; then
  STARTUP_CMD="node $NESTED_PATH/server.js"
else
  STARTUP_CMD="node server.js"
fi

# Stage all files
git add -A

# Check if there's anything to commit
if git diff --cached --quiet 2>/dev/null; then
  echo "  No changes to commit (artifact unchanged)."
  echo "  Force-pushing existing commit..."
  COMMIT_MSG="Deploy $(date '+%Y-%m-%d %H:%M') [${CURRENT_BRANCH}] (rebuild)"
  git commit --allow-empty -m "$COMMIT_MSG"
else
  echo "  Changes staged for commit:"
  echo ""
  git diff --cached --stat | head -20
  TOTAL_CHANGED=$(git diff --cached --stat | tail -1)
  echo "  $TOTAL_CHANGED"
  echo ""

  if [ "$AUTO_YES" = true ]; then
    COMMIT_MSG="Deploy $(date '+%Y-%m-%d %H:%M') [${CURRENT_BRANCH}]"
    echo "  Auto-committing: $COMMIT_MSG"
  else
    DEFAULT_MSG="Deploy $(date '+%Y-%m-%d %H:%M') [${CURRENT_BRANCH}]"
    read -p "  Commit message (Enter for '$DEFAULT_MSG'): " USER_MSG
    COMMIT_MSG="${USER_MSG:-$DEFAULT_MSG}"
  fi

  git commit -m "$COMMIT_MSG"
fi

echo ""

if [ "$AUTO_YES" = true ]; then
  echo "  Pushing to azure (master)..."
else
  echo "  Ready to push: $CURRENT_BRANCH -> azure/master"
  read -p "  Push now? (Y/n): " DO_PUSH
  if [ "$DO_PUSH" = "n" ] || [ "$DO_PUSH" = "N" ]; then
    echo "  Push skipped. You can push manually:"
    echo "    cd $STANDALONE_DIR && git push azure master --force"
    exit 0
  fi
fi

git push azure master --force

echo ""
echo "=========================================="
echo "  Deployment complete!"
echo "=========================================="

# ── Post-deploy info ────────────────────────────────────────────
echo ""
echo "Azure App Settings Required:"
echo "  SCM_DO_BUILD_DURING_DEPLOYMENT = false"
echo "  ENABLE_ORYX_BUILD             = false"
echo "  HOSTNAME                      = 0.0.0.0"
echo ""
echo "Startup Command:"
echo "  $STARTUP_CMD"
echo ""
echo "Test locally:"
echo "  cd \"$STANDALONE_DIR\""
echo "  PORT=8080 HOSTNAME=0.0.0.0 $STARTUP_CMD"
echo ""
