# Zed Claude One-Click Commit

Zed でショートカット一発で以下を実行します。

1. `git add -A`
2. staged diff を Claude Sonnet に渡す
3. Conventional Commits 形式のコミットメッセージを生成
4. `git commit`
5. `git push`
6. upstream が未設定なら `git push --set-upstream`

## ショートカット

- 日本語コミット: `Cmd + Shift + Enter`
- 英語コミット: `Cmd + Shift + Alt + Enter`

デフォルトは日本語です。

## 必要条件

- `git`
- Claude Code CLI の `claude`
- Claude Code にログイン済みであること
- push 先の Git remote が設定済みであること

確認:

```bash
claude --version
git --version
```

## インストール

### 安全な手動インストール（推奨）

1. `zed-claude-commit` を `~/.local/bin/zed-claude-commit` にコピー
2. 実行権限を付与

```bash
mkdir -p ~/.local/bin
cp zed-claude-commit ~/.local/bin/zed-claude-commit
chmod +x ~/.local/bin/zed-claude-commit
```

3. `tasks.json` の2タスクを `~/.config/zed/tasks.json` にマージ
4. `keymap.json` の binding を `~/.config/zed/keymap.json` にマージ
5. Zed を再読み込み

### 自動インストール

既存の `tasks.json` と `keymap.json` をバックアップ後に上書きしてよければ:

```bash
./install.sh
```

既存設定がある場合は、手動マージを推奨します。

## 動作

日本語ショートカットの場合:

```text
Cmd+Shift+Enter
  ↓
git add -A
  ↓
git diff --cached
  ↓
claude -p --model sonnet
  ↓
例: feat: 検索結果のキャッシュ処理を追加
  ↓
git commit
  ↓
git push
```

英語ショートカットでは、同じ処理でメッセージ本文だけ英語になります。

## モデル変更

`tasks.json` の:

```json
"AI_COMMIT_MODEL": "sonnet"
```

を変更してください。

## 注意

このスクリプトは `git add -A` を実行するため、未追跡ファイルも含めてすべて stage します。
`.env` や秘密情報など、コミットしたくないファイルは `.gitignore` に入れてください。

push に失敗しても、すでに完了した commit は取り消しません。
