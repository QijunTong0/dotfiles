'use strict';

const vscode = require('vscode');
const { execFile, spawn } = require('child_process');
const path = require('path');
const os = require('os');

const MAX_BUFFER = 20 * 1024 * 1024;

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { ...options, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function resolveRepoRoot() {
  const editor = vscode.window.activeTextEditor;
  let candidate;

  if (editor && editor.document.uri.scheme === 'file') {
    candidate = path.dirname(editor.document.uri.fsPath);
  } else if (vscode.workspace.workspaceFolders?.length) {
    candidate = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  if (!candidate) {
    throw new Error('Git リポジトリを判定できません。リポジトリ内のファイルを開いてください。');
  }

  try {
    const { stdout } = await execFileAsync('git', ['-C', candidate, 'rev-parse', '--show-toplevel']);
    return stdout.trim();
  } catch (error) {
    throw new Error('このファイルは Git リポジトリ内にありません。');
  }
}


async function pushCurrentBranch(repoRoot) {
  const { stdout: branchOut } = await execFileAsync('git', [
    '-C', repoRoot,
    'symbolic-ref', '--quiet', '--short', 'HEAD'
  ]);
  const branch = branchOut.trim();

  if (!branch) {
    throw new Error('detached HEAD のため push できません。ブランチをチェックアウトしてください。');
  }

  try {
    await execFileAsync('git', [
      '-C', repoRoot,
      'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'
    ]);
    await execFileAsync('git', ['-C', repoRoot, 'push']);
    return;
  } catch (upstreamError) {
    // No upstream (or it cannot be resolved): fall back to origin and set it.
    try {
      await execFileAsync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin']);
    } catch {
      throw new Error('upstream がなく、origin リモートも見つからないため push できません。');
    }

    await execFileAsync('git', [
      '-C', repoRoot,
      'push', '--set-upstream', 'origin', branch
    ]);
  }
}

function buildPrompt(diff, language) {
  const languageInstruction = language === 'en'
    ? [
        'Write the commit message in English.',
        'Use a concise Conventional Commits style such as feat:, fix:, docs:, refactor:, test:, chore:, etc.',
        'Return exactly one line containing only the commit message. Do not add Markdown, quotes, explanations, or alternatives.'
      ].join('\n')
    : [
        'コミットメッセージは日本語で書いてください。',
        'Conventional Commits 形式（feat:, fix:, docs:, refactor:, test:, chore: など）を使い、type 接頭辞は英語、要約部分は簡潔な日本語にしてください。',
        '出力はコミットメッセージ1行だけにしてください。Markdown、引用符、説明、候補の列挙は不要です。'
      ].join('\n');

  return [
    'You generate a Git commit message from the staged diff below.',
    'Use only the supplied diff as the basis for the message. Do not use tools or inspect other files.',
    languageInstruction,
    '',
    '--- staged diff ---',
    diff,
    '--- end diff ---'
  ].join('\n');
}

function runClaude(prompt, cwd, claudePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      claudePath,
      ['-p', '--model', 'sonnet', '--output-format', 'json', '--max-turns', '1'],
      {
        cwd,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('error', error => {
      if (error.code === 'ENOENT') {
        reject(new Error(`Claude Code CLI が見つかりません: ${claudePath}\n設定「Claude One-Click Commit: Claude Path」で実行ファイルのパスを指定してください。`));
      } else {
        reject(error);
      }
    });

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Claude Code が終了コード ${code} で失敗しました。`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        if (parsed.is_error) {
          reject(new Error(parsed.result || 'Claude Code がエラーを返しました。'));
          return;
        }
        resolve(parsed.result || '');
      } catch {
        reject(new Error(`Claude Code の出力を解析できませんでした。\n${stdout.slice(0, 1000)}`));
      }
    });

    child.stdin.end(prompt, 'utf8');
  });
}

function normalizeMessage(raw) {
  let message = String(raw || '').trim();
  message = message.replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '').trim();

  const firstLine = message
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) || '';

  return firstLine
    .replace(/^(["'`])(.+)\1$/, '$2')
    .trim();
}

async function commitWithClaude() {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Claude Commit',
      cancellable: false
    },
    async progress => {
      progress.report({ message: '変更を保存しています…' });
      await vscode.workspace.saveAll(false);

      progress.report({ message: 'git add -A…' });
      const repoRoot = await resolveRepoRoot();
      await execFileAsync('git', ['-C', repoRoot, 'add', '-A']);

      const { stdout: diff } = await execFileAsync('git', [
        '-C', repoRoot,
        'diff', '--cached', '--no-ext-diff', '--binary', '--no-color'
      ]);

      if (!diff.trim()) {
        vscode.window.showInformationMessage('コミットする変更はありません。');
        return;
      }

      const config = vscode.workspace.getConfiguration('claudeOneClickCommit');
      const language = config.get('language', 'ja');
      const configuredPath = config.get('claudePath', 'claude');
      const claudePath = configuredPath.startsWith('~/')
        ? path.join(os.homedir(), configuredPath.slice(2))
        : configuredPath;

      progress.report({ message: 'Claude Sonnet がコミットメッセージを作成しています…' });
      const prompt = buildPrompt(diff, language);
      const rawMessage = await runClaude(prompt, repoRoot, claudePath);
      const message = normalizeMessage(rawMessage);

      if (!message) {
        throw new Error('Claude が空のコミットメッセージを返しました。');
      }

      progress.report({ message: `git commit: ${message}` });
      await execFileAsync('git', ['-C', repoRoot, 'commit', '-m', message]);

      progress.report({ message: 'git push…' });
      try {
        await pushCurrentBranch(repoRoot);
      } catch (pushError) {
        const detail = pushError?.stderr?.trim() || pushError?.message || String(pushError);
        vscode.window.showErrorMessage(`コミットは完了しましたが push に失敗しました: ${detail}`);
        return;
      }

      vscode.window.showInformationMessage(`コミットして push しました: ${message}`);
    }
  );
}

async function changeLanguage() {
  const config = vscode.workspace.getConfiguration('claudeOneClickCommit');
  const current = config.get('language', 'ja');
  const choice = await vscode.window.showQuickPick(
    [
      { label: '日本語', description: current === 'ja' ? '現在の設定' : '', value: 'ja' },
      { label: 'English', description: current === 'en' ? 'Current setting' : '', value: 'en' }
    ],
    { placeHolder: 'コミットメッセージの言語を選択' }
  );

  if (!choice) return;

  await config.update('language', choice.value, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(
    choice.value === 'ja'
      ? 'Claude Commit の言語を日本語に設定しました。'
      : 'Claude Commit language set to English.'
  );
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeOneClickCommit.commit', async () => {
      try {
        await commitWithClaude();
      } catch (error) {
        const detail = error?.stderr?.trim() || error?.message || String(error);
        vscode.window.showErrorMessage(`Claude Commit に失敗しました: ${detail}`);
      }
    }),
    vscode.commands.registerCommand('claudeOneClickCommit.changeLanguage', changeLanguage)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
