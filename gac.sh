#!/usr/bin/env bash
# gac - Git Auto Commit using Claude Code
# Usage: gac [--en] [--dry-run] [--help]
#   --en       Generate commit message in English (default: Japanese)
#   --dry-run  Show generated message without committing
#   --help     Show this help

set -euo pipefail

LANG_OPT="ja"
DRY_RUN=false

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --en)       LANG_OPT="en" ;;
    --dry-run)  DRY_RUN=true ;;
    --help|-h)
      sed -n '2,7p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: gac [--en] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

# --- Check we're in a git repo ---
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: not a git repository" >&2
  exit 1
fi

# --- Stage all changes ---
echo "→ git add -A"
git add -A

# --- Check there's something to commit ---
if git diff --cached --quiet; then
  echo "Nothing to commit (working tree clean)"
  exit 0
fi

# --- Build prompt for Claude ---
DIFF=$(git diff --cached)
STAT=$(git diff --cached --stat)

if [ "$LANG_OPT" = "ja" ]; then
  LANG_INSTRUCTION="日本語でコミットメッセージを書いてください。"
  FORMAT_HINT="1行目は「何をしたか」を動詞で始めて簡潔に（例：「〇〇を追加」「〇〇を修正」「〇〇をリファクタリング」）。必要であれば空行の後に補足を続けてください。"
else
  LANG_INSTRUCTION="Write the commit message in English."
  FORMAT_HINT="Start the subject line with an imperative verb (e.g. Add, Fix, Refactor, Update). Add a body after a blank line if needed."
fi

PROMPT="以下のgit diffを分析して、変更内容を的確に表すコミットメッセージを生成してください。

## ルール
- ${FORMAT_HINT}
- subject行は50文字以内推奨
- コードブロック・マークダウン・前置き・説明は一切不要
- コミットメッセージのテキストのみを出力すること

## ${LANG_INSTRUCTION}

## 変更サマリー
${STAT}

## diff
${DIFF}"

# --- Call Claude ---
echo "→ Generating commit message via Claude..."

# claude -p でプロンプトを渡してメッセージだけ取得
COMMIT_MSG=$(claude -p "$PROMPT" 2>/dev/null)

if [ -z "$COMMIT_MSG" ]; then
  echo "Error: Claude returned empty message" >&2
  exit 1
fi

# --- Show message ---
echo ""
echo "┌─ Generated commit message ──────────────────────────"
echo "$COMMIT_MSG" | sed 's/^/│ /'
echo "└──────────────────────────────────────────────────────"
echo ""

# --- Dry run: stop here ---
if [ "$DRY_RUN" = true ]; then
  echo "(dry-run: not committing)"
  exit 0
fi

# --- Commit ---
echo "→ git commit"
git commit -m "$COMMIT_MSG"
echo "✓ Done"
