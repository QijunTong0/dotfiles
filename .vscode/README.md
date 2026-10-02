# Claude One-Click Commit

個人利用向けのローカル VS Code 拡張です。Marketplace に公開する必要はありません。

エディタ右上の `Claude Commit & Push` ボタンを1回押すと、次を順番に実行します。

1. 開いている変更を Save All
2. `git add -A`
3. staged diff を Claude Code (`claude -p --model sonnet`) に渡す
4. Conventional Commits 形式のコミットメッセージを生成
5. `git commit -m ...`
6. `git push`

upstream が未設定の場合は、`origin` が存在すれば現在のブランチを `git push --set-upstream origin <branch>` で push します。

## コミットメッセージの言語

デフォルトは日本語です。Conventional Commits の type (`feat:`, `fix:` など) は英語のままです。

Command Palette から `Claude Commit: Change Message Language` を実行すると、日本語 / English を切り替えられます。

## Claude CLI の場所

通常は `claude` を実行します。VS Code から見つからない場合は Settings の `Claude One-Click Commit: Claude Path` に絶対パスを指定してください。

## ボタン位置

`editor/title` の `navigation@0` に配置しているため、エディタタイトルの primary actions 内で最優先側（左側）に配置されます。VS Code や他拡張が同じ order を使う場合、完全な絶対位置は VS Code の並び順に依存します。


## VSIX の生成

拡張機能のディレクトリで依存関係をインストールします。

```bash
npm install
```

`vsce` を使って VSIX を生成します。

```bash
npx @vscode/vsce package
```

成功すると、カレントディレクトリに次のようなファイルが生成されます。

```text
claude-one-click-commit-0.2.0.vsix
```

生成した VSIX は、以下のコマンドでインストールできます。

```bash
code --install-extension claude-one-click-commit-0.2.0.vsix
```

または VS Code の Extensions 画面から、

```text
... → Install from VSIX...
```

を選択してインストールできます。
```
