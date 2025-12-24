/**
 * MCP ACS Testing Manager Extension
 *
 * Main extension entry point - AI-First Architecture
 *
 * This extension focuses on AI-powered testing insights and analysis.
 * Test execution is handled by VS Code's Testing API and framework-specific extensions.
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from './mcpClient';
import { TestExplorerProvider } from './testExplorerProvider';
import { TestTreeProvider } from './testTreeProvider';
import { TestHistoryTreeProvider } from './testHistoryTreeProvider';
import { CoverageTreeProvider } from './coverageTreeProvider';
import { FlakyTestsTreeProvider } from './flakyTestsTreeProvider';
import { TestTagsTreeProvider } from './testTagsTreeProvider';
import { TestCodeLensProvider } from './testCodeLensProvider';
import { TestDiagnosticsProvider } from './testDiagnosticsProvider';
import { CoverageDecorator } from './coverageDecorator';
import { TestHoverProvider } from './testHoverProvider';
import { TestCompletionProvider } from './testCompletionProvider';
import { TestDefinitionProvider } from './testDefinitionProvider';
import { TestReferenceProvider } from './testReferenceProvider';
import { TestDocumentSymbolProvider } from './testDocumentSymbolProvider';
import { TestWorkspaceSymbolProvider } from './testWorkspaceSymbolProvider';
import {
  TestResultsWebviewPanel,
  CoverageReportWebviewPanel,
  TestGenerationWebviewPanel,
  MutationTestingWebviewPanel,
  TestImpactWebviewPanel,
  TestPerformanceWebviewPanel,
} from './webviews';
import { StatusBarManager } from './statusBarManager';
import { NotificationManager } from './notificationManager';
import { TestTaskProvider } from './testTaskProvider';
import { TestDebugConfigurationProvider } from './testDebugConfigurationProvider';
import { SettingsManager } from './settingsManager';
import { registerAllCommands } from './extension-commands';

let settingsManager: SettingsManager | undefined;
let mcpClient: MCPTestingClient | undefined;
let statusBarManager: StatusBarManager | undefined;
let notificationManager: NotificationManager | undefined;
let testExplorer: TestExplorerProvider | undefined;
let testTreeProvider: TestTreeProvider | undefined;
let testHistoryProvider: TestHistoryTreeProvider | undefined;
let coverageProvider: CoverageTreeProvider | undefined;
let flakyTestsProvider: FlakyTestsTreeProvider | undefined;
let testTagsProvider: TestTagsTreeProvider | undefined;
let codeLensProvider: TestCodeLensProvider | undefined;
let diagnosticsProvider: TestDiagnosticsProvider | undefined;
let coverageDecorator: CoverageDecorator | undefined;
let hoverProvider: TestHoverProvider | undefined;
let completionProvider: TestCompletionProvider | undefined;
let definitionProvider: TestDefinitionProvider | undefined;
let referenceProvider: TestReferenceProvider | undefined;
let documentSymbolProvider: TestDocumentSymbolProvider | undefined;
let workspaceSymbolProvider: TestWorkspaceSymbolProvider | undefined;
let taskProvider: TestTaskProvider | undefined;
let debugConfigProvider: TestDebugConfigurationProvider | undefined;
let outputChannel: vscode.LogOutputChannel;

// Webview panels
let testResultsPanel: TestResultsWebviewPanel | undefined;
let coverageReportPanel: CoverageReportWebviewPanel | undefined;
let testGenerationPanel: TestGenerationWebviewPanel | undefined;
let mutationTestingPanel: MutationTestingWebviewPanel | undefined;
let testImpactPanel: TestImpactWebviewPanel | undefined;
let testPerformancePanel: TestPerformanceWebviewPanel | undefined;

/**
 * Activate the extension
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('[MCP ACS Testing] activate() called');
  try {
    await activateInternal(context);
    console.log('[MCP ACS Testing] activateInternal() completed successfully');

    // Listen to VS Code test events
    setupTestEventListeners(context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[MCP ACS Testing] FATAL ERROR during activation:', errorMessage);
    if (errorStack) {
      console.error('[MCP ACS Testing] Stack trace:', errorStack);
    }
    vscode.window.showErrorMessage(`MCP ACS Testing Manager failed to activate: ${errorMessage}`);
    throw error;
  }
}

/**
 * Setup VS Code test event listeners
 * This allows us to capture test results from ANY test runner
 */
function setupTestEventListeners(context: vscode.ExtensionContext) {
  // Check if outputChannel is initialized
  if (!outputChannel) {
    console.warn('[MCP ACS Testing] outputChannel not initialized, skipping test event listeners');
    return;
  }

  // Check if VS Code Testing API is available (requires VS Code 1.59.0+)
  if (!vscode.test || !vscode.test.onDidChangeTestResults) {
    outputChannel.warn('VS Code Testing API not available, skipping test event listeners');
    return;
  }

  try {
    // Listen to test result changes
    context.subscriptions.push(
      vscode.test.onDidChangeTestResults((event) => {
        outputChannel.info(`Test results changed: ${event.results.length} results`);

        // Update our test history
        for (const result of event.results) {
          const testRun = result;
          outputChannel.info(`Test run completed: ${testRun.results.length} tests`);

          // TODO: Store results in test history
          // TODO: Update coverage data
          // TODO: Detect flaky tests
        }
      })
    );

    outputChannel.info('✓ VS Code test event listeners registered');
  } catch (error) {
    outputChannel.error(
      `Failed to setup test event listeners: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function activateInternal(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('MCP ACS Testing Manager', {
    log: true,
  });
  outputChannel.appendLine('MCP ACS Testing Manager extension activating...');

  // Initialize Settings Manager
  settingsManager = SettingsManager.getInstance(outputChannel);
  context.subscriptions.push(settingsManager);
  outputChannel.appendLine('Settings Manager initialized');

  // Validate configuration
  const validation = settingsManager.validateConfiguration();
  if (!validation.valid) {
    outputChannel.warn(`Configuration validation warnings: ${validation.errors.join(', ')}`);
  }

  // Check if we're running in test mode
  outputChannel.appendLine(
    `🔍 Checking test mode: VSCODE_TEST_MODE=${process.env.VSCODE_TEST_MODE}, NODE_ENV=${process.env.NODE_ENV}, extensionMode=${context.extensionMode}`
  );
  const isTestMode =
    process.env.VSCODE_TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    context.extensionMode === vscode.ExtensionMode.Test;

  outputChannel.appendLine(`🔍 isTestMode=${isTestMode}`);

  if (isTestMode) {
    outputChannel.appendLine('Running in test mode - skipping server initialization');
    return;
  }

  outputChannel.appendLine('✓ Not in test mode, continuing with initialization...');

  // Register chat participant
  try {
    outputChannel.appendLine('🔍 Registering chat participant...');
    const participant = vscode.chat.createChatParticipant(
      'mcp-acs-testing.participant',
      async (request, context, stream, token) => {
        const prompt = request.prompt;
        stream.markdown(`Processing: ${prompt}\n\n`);

        if (prompt.includes('run') || prompt.includes('test')) {
          stream.markdown('Running tests...');
        } else if (prompt.includes('coverage')) {
          stream.markdown('Analyzing coverage...');
        } else if (prompt.includes('generate')) {
          stream.markdown('Generating tests...');
        } else {
          stream.markdown(
            'Available operations:\n- Run tests\n- Analyze coverage\n- Generate tests\n- Debug failures'
          );
        }
      }
    );

    context.subscriptions.push(participant);
    outputChannel.appendLine('✓ Chat participant registered');
  } catch (error) {
    outputChannel.error(
      `✗ Failed to register chat participant: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  outputChannel.appendLine('🔍 About to register commands...');
  console.log('[MCP ACS Testing] About to register commands...');

  try {
    // Register all commands using the new command registration module
    registerAllCommands({
      context,
      outputChannel,
      mcpClient,
      testExplorer,
      testTreeProvider,
      testHistoryProvider,
      coverageProvider,
      flakyTestsProvider,
      testTagsProvider,
      codeLensProvider,
      diagnosticsProvider,
      coverageDecorator,
      testResultsPanel,
      coverageReportPanel,
      testGenerationPanel,
      mutationTestingPanel,
      testImpactPanel,
      testPerformancePanel,
    });
    console.log('[MCP ACS Testing] ✓ All commands registered successfully');
    outputChannel.appendLine('✓ All commands registered successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[MCP ACS Testing] ERROR registering commands:', errorMessage);
    outputChannel.error(`ERROR registering commands: ${errorMessage}`);
    if (errorStack) {
      console.error('[MCP ACS Testing] Stack trace:', errorStack);
      outputChannel.error(`Stack trace: ${errorStack}`);
    }
    throw error;
  }

  console.log('[MCP ACS Testing] About to initialize components...');
  outputChannel.appendLine('🔍 About to initialize components...');
  await initializeComponents(context);
}

async function initializeComponents(context: vscode.ExtensionContext) {
  console.log('[MCP ACS Testing] About to initialize Status Bar Manager...');
  outputChannel.appendLine('🔍 About to initialize Status Bar Manager...');

  // Initialize Status Bar Manager early (before MCP client starts)
  // This ensures the extension shows up in the shared status bar even if the MCP client fails
  try {
    outputChannel.appendLine('🔍 Creating StatusBarManager instance...');
    statusBarManager = new StatusBarManager(undefined, outputChannel);
    context.subscriptions.push(statusBarManager);
    outputChannel.appendLine('✓ Status Bar Manager initialized');
  } catch (error) {
    outputChannel.error(
      `✗ Failed to initialize Status Bar Manager: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // Initialize MCP client
  const config = settingsManager.getConfiguration();

  if (config.server.autoStart) {
    try {
      mcpClient = new MCPTestingClient(outputChannel);
      await mcpClient.start();
      outputChannel.appendLine('MCP Testing client started successfully');

      // Connect MCP client to StatusBarManager
      if (statusBarManager) {
        statusBarManager.setMCPClient(mcpClient);
      }

      // Initialize Notification Manager
      notificationManager = new NotificationManager(mcpClient, outputChannel);
      context.subscriptions.push(notificationManager);
      outputChannel.appendLine('✓ Notification Manager initialized');

      // Initialize Test Explorer
      // Initialize Test Explorer (uses VS Code's native TestController API)
      try {
        testExplorer = new TestExplorerProvider(mcpClient, outputChannel);
        context.subscriptions.push(testExplorer);
        outputChannel.appendLine('✓ Test Explorer initialized');
      } catch (error) {
        outputChannel.error(
          `✗ Failed to initialize Test Explorer: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Initialize Test Tree Provider (for custom tree view)
      try {
        testTreeProvider = new TestTreeProvider(mcpClient, outputChannel);
        const testTreeView = vscode.window.createTreeView('mcp-testing-tests', {
          treeDataProvider: testTreeProvider,
          showCollapseAll: true,
        });
        context.subscriptions.push(testTreeView);
        context.subscriptions.push(testTreeProvider);
        outputChannel.appendLine('✓ Test Tree provider initialized');
      } catch (error) {
        outputChannel.error(
          `✗ Failed to initialize Test Tree provider: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Initialize Test History Tree Provider
      try {
        testHistoryProvider = new TestHistoryTreeProvider(mcpClient, outputChannel);
        const testHistoryView = vscode.window.createTreeView('mcp-testing-history', {
          treeDataProvider: testHistoryProvider,
          showCollapseAll: true,
        });
        context.subscriptions.push(testHistoryView);
        context.subscriptions.push(testHistoryProvider);
        outputChannel.appendLine('✓ Test History provider initialized');
      } catch (error) {
        outputChannel.error(
          `✗ Failed to initialize Test History provider: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Initialize Coverage Tree Provider
      try {
        coverageProvider = new CoverageTreeProvider(mcpClient, outputChannel);
        const coverageView = vscode.window.createTreeView('mcp-testing-coverage', {
          treeDataProvider: coverageProvider,
          showCollapseAll: true,
        });
        context.subscriptions.push(coverageView);
        context.subscriptions.push(coverageProvider);
        outputChannel.appendLine('✓ Coverage provider initialized');
      } catch (error) {
        outputChannel.error(
          `✗ Failed to initialize Coverage provider: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Initialize Flaky Tests Tree Provider
      try {
        flakyTestsProvider = new FlakyTestsTreeProvider(mcpClient, outputChannel);
        const flakyTestsView = vscode.window.createTreeView('mcp-testing-flaky', {
          treeDataProvider: flakyTestsProvider,
          showCollapseAll: true,
        });
        context.subscriptions.push(flakyTestsView);
        context.subscriptions.push(flakyTestsProvider);
        outputChannel.appendLine('✓ Flaky Tests provider initialized');
      } catch (error) {
        outputChannel.error(
          `✗ Failed to initialize Flaky Tests provider: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Initialize Test Tags Tree Provider
      try {
        testTagsProvider = new TestTagsTreeProvider(mcpClient, outputChannel);
        const testTagsView = vscode.window.createTreeView('mcp-testing-tags', {
          treeDataProvider: testTagsProvider,
          showCollapseAll: true,
        });
        context.subscriptions.push(testTagsView);
        context.subscriptions.push(testTagsProvider);
        outputChannel.appendLine('✓ Test Tags provider initialized');
      } catch (error) {
        outputChannel.error(
          `✗ Failed to initialize Test Tags provider: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Initialize CodeLens Provider
      codeLensProvider = new TestCodeLensProvider(mcpClient, outputChannel);
      const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        [
          { language: 'typescript', scheme: 'file' },
          { language: 'javascript', scheme: 'file' },
          { language: 'typescriptreact', scheme: 'file' },
          { language: 'javascriptreact', scheme: 'file' },
          { language: 'python', scheme: 'file' },
        ],
        codeLensProvider
      );
      context.subscriptions.push(codeLensDisposable);
      context.subscriptions.push(codeLensProvider);
      outputChannel.appendLine('CodeLens provider initialized');

      // Initialize Diagnostics Provider
      diagnosticsProvider = new TestDiagnosticsProvider(mcpClient, outputChannel);
      const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
        [
          { language: 'typescript', scheme: 'file' },
          { language: 'javascript', scheme: 'file' },
          { language: 'typescriptreact', scheme: 'file' },
          { language: 'javascriptreact', scheme: 'file' },
          { language: 'python', scheme: 'file' },
        ],
        diagnosticsProvider,
        {
          providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
        }
      );
      context.subscriptions.push(codeActionDisposable);
      context.subscriptions.push(diagnosticsProvider);
      outputChannel.appendLine('Diagnostics provider initialized');

      // Initialize Coverage Decorator
      coverageDecorator = new CoverageDecorator(mcpClient, outputChannel);
      context.subscriptions.push(coverageDecorator);
      outputChannel.appendLine('Coverage decorator initialized');

      // Initialize Hover Provider
      hoverProvider = new TestHoverProvider(mcpClient, outputChannel);
      const hoverDisposable = vscode.languages.registerHoverProvider(
        [
          { language: 'typescript', scheme: 'file' },
          { language: 'javascript', scheme: 'file' },
          { language: 'typescriptreact', scheme: 'file' },
          { language: 'javascriptreact', scheme: 'file' },
          { language: 'python', scheme: 'file' },
        ],
        hoverProvider
      );
      context.subscriptions.push(hoverDisposable);
      context.subscriptions.push(hoverProvider);
      outputChannel.appendLine('Hover provider initialized');

      // Initialize Completion Provider
      completionProvider = new TestCompletionProvider(mcpClient, outputChannel);
      const completionDisposable = vscode.languages.registerCompletionItemProvider(
        [
          { language: 'typescript', scheme: 'file' },
          { language: 'javascript', scheme: 'file' },
          { language: 'typescriptreact', scheme: 'file' },
          { language: 'javascriptreact', scheme: 'file' },
          { language: 'python', scheme: 'file' },
        ],
        completionProvider,
        '.', // Trigger on dot
        '(', // Trigger on opening parenthesis
        ' ' // Trigger on space
      );
      context.subscriptions.push(completionDisposable);
      context.subscriptions.push(completionProvider);
      outputChannel.appendLine('Completion provider initialized');

      // Initialize Definition Provider
      definitionProvider = new TestDefinitionProvider(mcpClient, outputChannel);
      const definitionDisposable = vscode.languages.registerDefinitionProvider(
        [
          { language: 'typescript', scheme: 'file' },
          { language: 'javascript', scheme: 'file' },
          { language: 'typescriptreact', scheme: 'file' },
          { language: 'javascriptreact', scheme: 'file' },
          { language: 'python', scheme: 'file' },
        ],
        definitionProvider
      );
      context.subscriptions.push(definitionDisposable);
      context.subscriptions.push(definitionProvider);
      outputChannel.appendLine('Definition provider initialized');

      // Initialize Reference Provider
      referenceProvider = new TestReferenceProvider(mcpClient, outputChannel);
      const referenceDisposable = vscode.languages.registerReferenceProvider(
        [
          { language: 'typescript', scheme: 'file' },
          { language: 'javascript', scheme: 'file' },
          { language: 'typescriptreact', scheme: 'file' },
          { language: 'javascriptreact', scheme: 'file' },
          { language: 'python', scheme: 'file' },
        ],
        referenceProvider
      );
      context.subscriptions.push(referenceDisposable);
      context.subscriptions.push(referenceProvider);
      outputChannel.appendLine('Reference provider initialized');

      // Initialize Document Symbol Provider
      documentSymbolProvider = new TestDocumentSymbolProvider(mcpClient, outputChannel);
      const documentSymbolDisposable = vscode.languages.registerDocumentSymbolProvider(
        [
          { language: 'typescript', scheme: 'file' },
          { language: 'javascript', scheme: 'file' },
          { language: 'typescriptreact', scheme: 'file' },
          { language: 'javascriptreact', scheme: 'file' },
          { language: 'python', scheme: 'file' },
        ],
        documentSymbolProvider
      );
      context.subscriptions.push(documentSymbolDisposable);
      context.subscriptions.push(documentSymbolProvider);
      outputChannel.appendLine('Document symbol provider initialized');

      // Initialize Workspace Symbol Provider
      workspaceSymbolProvider = new TestWorkspaceSymbolProvider(mcpClient, outputChannel);
      const workspaceSymbolDisposable =
        vscode.languages.registerWorkspaceSymbolProvider(workspaceSymbolProvider);
      context.subscriptions.push(workspaceSymbolDisposable);
      context.subscriptions.push(workspaceSymbolProvider);
      outputChannel.appendLine('Workspace symbol provider initialized');

      // Initialize Task Provider
      taskProvider = new TestTaskProvider(mcpClient, outputChannel);
      const taskProviderDisposable = vscode.tasks.registerTaskProvider('mcp-testing', taskProvider);
      context.subscriptions.push(taskProviderDisposable);
      context.subscriptions.push(taskProvider);
      outputChannel.appendLine('Task provider initialized');

      // Initialize Debug Configuration Provider
      debugConfigProvider = new TestDebugConfigurationProvider(mcpClient, outputChannel);
      const debugConfigDisposable = vscode.debug.registerDebugConfigurationProvider(
        'node',
        debugConfigProvider
      );
      const debugConfigDisposablePython = vscode.debug.registerDebugConfigurationProvider(
        'python',
        debugConfigProvider
      );
      context.subscriptions.push(debugConfigDisposable);
      context.subscriptions.push(debugConfigDisposablePython);
      context.subscriptions.push(debugConfigProvider);
      outputChannel.appendLine('Debug configuration provider initialized');

      // Register debug session event handlers
      context.subscriptions.push(
        vscode.debug.onDidStartDebugSession((session) => {
          if (debugConfigProvider) {
            debugConfigProvider.onDebugSessionStart(session);
          }
        })
      );

      context.subscriptions.push(
        vscode.debug.onDidTerminateDebugSession((session) => {
          if (debugConfigProvider) {
            debugConfigProvider.onDebugSessionStop(session);
          }
        })
      );

      // Load initial data for tree providers
      await testTagsProvider.loadTests();
    } catch (error: any) {
      outputChannel.appendLine(`Failed to start MCP client: ${error}`);
      vscode.window.showWarningMessage(
        'MCP Testing server could not be started. Some features may be unavailable.'
      );
    }
  }

  outputChannel.appendLine('MCP ACS Testing Manager extension activated');
}

/**
 * Deactivate the extension
 */
export function deactivate() {
  // Dispose webview panels
  if (testResultsPanel) {
    testResultsPanel.dispose();
  }
  if (coverageReportPanel) {
    coverageReportPanel.dispose();
  }
  if (testGenerationPanel) {
    testGenerationPanel.dispose();
  }
  if (mutationTestingPanel) {
    mutationTestingPanel.dispose();
  }
  if (testImpactPanel) {
    testImpactPanel.dispose();
  }
  if (testPerformancePanel) {
    testPerformancePanel.dispose();
  }

  // Dispose managers
  if (settingsManager) {
    settingsManager.dispose();
  }
  if (notificationManager) {
    notificationManager.dispose();
  }
  if (statusBarManager) {
    statusBarManager.dispose();
  }

  // Dispose other components
  if (debugConfigProvider) {
    debugConfigProvider.dispose();
  }
  if (taskProvider) {
    taskProvider.dispose();
  }
  if (workspaceSymbolProvider) {
    workspaceSymbolProvider.dispose();
  }
  if (documentSymbolProvider) {
    documentSymbolProvider.dispose();
  }
  if (referenceProvider) {
    referenceProvider.dispose();
  }
  if (definitionProvider) {
    definitionProvider.dispose();
  }
  if (completionProvider) {
    completionProvider.dispose();
  }
  if (hoverProvider) {
    hoverProvider.dispose();
  }
  if (coverageDecorator) {
    coverageDecorator.dispose();
  }
  if (diagnosticsProvider) {
    diagnosticsProvider.dispose();
  }
  if (codeLensProvider) {
    codeLensProvider.dispose();
  }
  if (testTagsProvider) {
    testTagsProvider.dispose();
  }
  if (flakyTestsProvider) {
    flakyTestsProvider.dispose();
  }
  if (coverageProvider) {
    coverageProvider.dispose();
  }
  if (testHistoryProvider) {
    testHistoryProvider.dispose();
  }
  if (testTreeProvider) {
    testTreeProvider.dispose();
  }
  if (testExplorer) {
    testExplorer.dispose();
  }
  if (mcpClient) {
    mcpClient.dispose();
  }
  if (outputChannel) {
    outputChannel.dispose();
  }
}
