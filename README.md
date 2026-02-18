# Dotfiles Setup Guide

このディレクトリには、zshの環境設定ファイルが含まれています。新しい環境でこれらの設定を利用するための手順は以下の通りです。

## 1. 前提条件 (Prerequisites)

これらの設定ファイルは、以下のツールやフレームワークに依存している可能性があります。新しい環境で設定を適用する前に、これらがインストールされていることを推奨します。

*   **Zsh**: シェル本体
*   **Oh My Zsh**: Zshの構成管理フレームワーク
    *   インストール: `sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`
*   **Powerlevel10k**: Zshのテーマ
    *   インストール: `git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k`

## 2. インストール (Installation)

このディレクトリにある設定ファイルをホームディレクトリにコピーします。
**注意:** 既存の設定ファイルがある場合、上書きされます。必要に応じて事前にバックアップを取ってください。

```bash
# Dotfilesディレクトリに移動
cd path/to/this/directory

# 設定ファイルをホームディレクトリにコピー
cp .zshrc .zprofile .zshenv .p10k.zsh ~/
```

## 3. 設定の適用 (Activation)

ファイルをコピーした後、新しいシェルを開くか、以下のコマンドを実行して設定を再読み込みしてください。

```bash
source ~/.zshrc
```

## ファイルの説明

*   `.zshrc`: メインの設定ファイル (エイリアス、プラグイン設定など)
*   `.p10k.zsh`: Powerlevel10kテーマの詳細設定
