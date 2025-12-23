/**
 * TestGenerationWebviewPanel - Webview panel for test generation
 *
 * Displays generated tests with syntax highlighting, editing, and batch generation
 */

import * as vscode from 'vscode';
import { MCPTestingClient, GeneratedTest } from '../mcpClient';

/**
 * TestGenerationWebviewPanel
 *
 * Manages a webview panel for test generation with editing and saving capabilities
 */
export class TestGenerationWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  private generatedTests: GeneratedTest[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {}

  /**
   * Show the test generation panel
   */
  public async show(tests: GeneratedTest[]): Promise<void> {
    this.generatedTests = tests;

    if (this.panel) {
      // Panel already exists, update it
      this.panel.reveal(vscode.ViewColumn.Two);
      this.updateTests(tests);
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'mcpTestingGeneration',
      'Generated Tests',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri],
      }
    );

    // Set icon
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png'),
      dark: vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png'),
    };

    // Set HTML content
    this.panel.webview.html = this.getHtmlContent(tests);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
      },
      null,
      this.disposables
    );
  }

  /**
   * Update tests in the panel
   */
  private updateTests(tests: GeneratedTest[]): void {
    if (!this.panel) {
      return;
    }

    this.generatedTests = tests;
    this.panel.webview.postMessage({
      type: 'updateTests',
      tests,
    });
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'saveTest':
        await this.saveTest(message.index, message.code);
        break;

      case 'saveAllTests':
        await this.saveAllTests(message.tests);
        break;

      case 'regenerateTest':
        await this.regenerateTest(message.index);
        break;

      case 'generateMore':
        await this.generateMore(message.filePath);
        break;

      case 'previewTest':
        await this.previewTest(message.code, message.framework);
        break;

      default:
        this.outputChannel.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Save a single test
   */
  private async saveTest(index: number, code: string): Promise<void> {
    try {
      const test = this.generatedTests[index];
      if (!test) {
        vscode.window.showWarningMessage('Test not found');
        return;
      }

      // Determine test file path
      const testFilePath = this.getTestFilePath(test.targetFile, test.framework);

      // Check if file exists
      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(testFilePath);
      } catch {
        // File doesn't exist, create it
        const uri = vscode.Uri.file(testFilePath);
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(uri, { ignoreIfExists: true });
        await vscode.workspace.applyEdit(edit);
        document = await vscode.workspace.openTextDocument(uri);
      }

      // Append test to file
      const edit = new vscode.WorkspaceEdit();
      const lastLine = document.lineCount;
      const position = new vscode.Position(lastLine, 0);
      edit.insert(document.uri, position, `\n${code}\n`);
      await vscode.workspace.applyEdit(edit);
      await document.save();

      vscode.window.showInformationMessage(`Test saved to ${testFilePath}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save all tests
   */
  private async saveAllTests(tests: Array<{ index: number; code: string }>): Promise<void> {
    try {
      for (const { index, code } of tests) {
        await this.saveTest(index, code);
      }
      vscode.window.showInformationMessage(`Saved ${tests.length} tests`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save tests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Regenerate a test
   */
  private async regenerateTest(index: number): Promise<void> {
    try {
      const test = this.generatedTests[index];
      if (!test) {
        vscode.window.showWarningMessage('Test not found');
        return;
      }

      vscode.window.showInformationMessage(`Regenerating test for ${test.targetFunction}...`);
      const newTests = await this.mcpClient.generateTests(test.targetFile);

      if (newTests.length > 0) {
        this.generatedTests[index] = newTests[0];
        this.updateTests(this.generatedTests);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to regenerate test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate more tests
   */
  private async generateMore(filePath: string): Promise<void> {
    try {
      vscode.window.showInformationMessage(`Generating more tests for ${filePath}...`);
      const newTests = await this.mcpClient.generateTests(filePath);
      this.generatedTests.push(...newTests);
      this.updateTests(this.generatedTests);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Preview a test
   */
  private async previewTest(code: string, framework: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument({
        content: code,
        language: this.getLanguageId(framework),
      });
      await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to preview test: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get test file path
   */
  private getTestFilePath(targetFile: string, framework: string): string {
    const ext = targetFile.split('.').pop();
    const baseName = targetFile.replace(/\.[^/.]+$/, '');

    switch (framework) {
      case 'jest':
      case 'vitest':
        return `${baseName}.test.${ext}`;
      case 'mocha':
        return `${baseName}.spec.${ext}`;
      case 'pytest':
        return `test_${baseName.split('/').pop()}.py`;
      default:
        return `${baseName}.test.${ext}`;
    }
  }

  /**
   * Get language ID for framework
   */
  private getLanguageId(framework: string): string {
    switch (framework) {
      case 'pytest':
        return 'python';
      case 'jest':
      case 'mocha':
      case 'vitest':
        return 'typescript';
      default:
        return 'typescript';
    }
  }

  /**
   * Get HTML content for the webview
   */
  private getHtmlContent(tests: GeneratedTest[]): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Generated Tests</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }

        h1, h2 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }

        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .test-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .test-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 5px;
        }

        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .test-title {
            font-size: 16px;
            font-weight: bold;
        }

        .test-meta {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
            font-size: 12px;
            opacity: 0.8;
        }

        .test-meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .test-description {
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-input-background);
            border-radius: 3px;
            font-size: 13px;
        }

        .test-code {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 15px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            overflow-x: auto;
            margin-bottom: 15px;
        }

        .test-code textarea {
            width: 100%;
            min-height: 200px;
            background-color: transparent;
            color: var(--vscode-editor-foreground);
            border: none;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            resize: vertical;
            outline: none;
        }

        .test-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }

        .badge-unit { background-color: #2196f3; color: white; }
        .badge-property { background-color: #9c27b0; color: white; }
        .badge-integration { background-color: #ff9800; color: white; }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            opacity: 0.6;
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>Generated Tests</h1>

    <div class="controls">
        <button id="saveAllBtn">Save All Tests</button>
        <button id="generateMoreBtn" class="secondary">Generate More Tests</button>
        <button id="clearAllBtn" class="secondary">Clear All</button>
    </div>

    <div id="testList" class="test-list"></div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let tests = ${JSON.stringify(tests)};

        // Initialize
        renderTests();

        // Event listeners
        document.getElementById('saveAllBtn').addEventListener('click', saveAllTests);
        document.getElementById('generateMoreBtn').addEventListener('click', generateMore);
        document.getElementById('clearAllBtn').addEventListener('click', clearAll);

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateTests':
                    tests = message.tests;
                    renderTests();
                    break;
            }
        });

        function renderTests() {
            const testList = document.getElementById('testList');

            if (tests.length === 0) {
                testList.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">🧪</div>
                        <h2>No Tests Generated</h2>
                        <p>Click "Generate More Tests" to create tests for your code</p>
                    </div>
                \`;
                return;
            }

            testList.innerHTML = '';

            tests.forEach((test, index) => {
                const testItem = document.createElement('div');
                testItem.className = 'test-item';
                testItem.innerHTML = \`
                    <div class="test-header">
                        <div class="test-title">\${escapeHtml(test.name)}</div>
                        <span class="badge badge-\${test.type}">\${test.type.toUpperCase()}</span>
                    </div>
                    <div class="test-meta">
                        <div class="test-meta-item">
                            <span>📁</span>
                            <span>\${escapeHtml(test.targetFile)}</span>
                        </div>
                        <div class="test-meta-item">
                            <span>🎯</span>
                            <span>\${escapeHtml(test.targetFunction)}</span>
                        </div>
                        <div class="test-meta-item">
                            <span>🔧</span>
                            <span>\${escapeHtml(test.framework)}</span>
                        </div>
                    </div>
                    <div class="test-description">
                        \${escapeHtml(test.description)}
                    </div>
                    <div class="test-code">
                        <textarea id="code-\${index}">\${escapeHtml(test.code)}</textarea>
                    </div>
                    <div class="test-actions">
                        <button onclick="saveTest(\${index})">Save Test</button>
                        <button onclick="previewTest(\${index})" class="secondary">Preview</button>
                        <button onclick="regenerateTest(\${index})" class="secondary">Regenerate</button>
                    </div>
                \`;
                testList.appendChild(testItem);
            });
        }

        function saveTest(index) {
            const code = document.getElementById(\`code-\${index}\`).value;
            vscode.postMessage({ type: 'saveTest', index, code });
        }

        function saveAllTests() {
            const testsToSave = tests.map((test, index) => ({
                index,
                code: document.getElementById(\`code-\${index}\`).value
            }));
            vscode.postMessage({ type: 'saveAllTests', tests: testsToSave });
        }

        function previewTest(index) {
            const code = document.getElementById(\`code-\${index}\`).value;
            const framework = tests[index].framework;
            vscode.postMessage({ type: 'previewTest', code, framework });
        }

        function regenerateTest(index) {
            vscode.postMessage({ type: 'regenerateTest', index });
        }

        function generateMore() {
            if (tests.length > 0) {
                const filePath = tests[0].targetFile;
                vscode.postMessage({ type: 'generateMore', filePath });
            } else {
                alert('No tests to generate from. Please generate tests from a file first.');
            }
        }

        function clearAll() {
            if (confirm('Are you sure you want to clear all generated tests?')) {
                tests = [];
                renderTests();
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
