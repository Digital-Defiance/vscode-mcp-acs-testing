/**
 * MCP ACS Testing Manager Extension
 *
 * Main extension entry point
 */

import * as vscode from 'vscode';
import { MCPTestingClient } from './mcpClient';
import { TestExplorerProvider } from './testExplorerProvider';
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

let settingsManager: SettingsManager | undefined;
let mcpClient: MCPTestingClient | undefined;
let statusBarManager: StatusBarManager | undefined;
let notificationManager: NotificationManager | undefined;
let testExplorer: TestExplorerProvider | undefined;
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

async function activateInternal(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('MCP ACS Testing Manager', {
    log: true,
  });
  outputChannel.appendLine('MCP ACS Testing Manager extension activating...');
  outputChannel.appendLine('🔥 CODE VERSION: 2025-12-23T14:55 - FOUND TEST MODE BUG 🔥');

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
    registerAllCommands(context);
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

function registerAllCommands(context: vscode.ExtensionContext) {
  console.log('[MCP ACS Testing] Registering mcp-testing.runTests');
  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runTests', async () => {
      vscode.window.showInformationMessage(
        'Run tests - Use Copilot with @testing for AI-assisted testing'
      );
    })
  );

  // Note: mcp-testing.runTestAtCursor is registered later with CodeLens support

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runAllTests', async () => {
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage('Running all tests...');
          await mcpClient.runTests({});
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to run tests: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runTestFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage(`Running tests in ${editor.document.fileName}`);
          await mcpClient.runTests({ testPath: editor.document.uri.fsPath });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to run test file: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runTestSuite', async () => {
      const suites = await mcpClient?.listTests();
      if (!suites || suites.length === 0) {
        vscode.window.showWarningMessage('No test suites found');
        return;
      }
      const suite = await vscode.window.showQuickPick(
        suites
          .map((s) => s.suite?.join(' > ') || 'Unknown')
          .filter((s, i, a) => a.indexOf(s) === i),
        { placeHolder: 'Select a test suite to run' }
      );
      if (suite) {
        vscode.window.showInformationMessage(`Running test suite: ${suite}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.debugTest', async () => {
      vscode.window.showInformationMessage(
        'Debug test - Use Copilot with @testing for AI-assisted debugging'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.searchTests', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Enter search query for tests',
        placeHolder: 'e.g., "should handle errors"',
      });
      if (query && mcpClient) {
        try {
          const results = await mcpClient.searchTests(query);
          vscode.window.showInformationMessage(`Found ${results.length} tests matching "${query}"`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to search tests: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.filterTests', async () => {
      const filterType = await vscode.window.showQuickPick(['Status', 'Duration', 'Tag', 'File'], {
        placeHolder: 'Select filter type',
      });
      if (filterType) {
        vscode.window.showInformationMessage(`Filtering tests by ${filterType}`);
      }
    })
  );

  // Note: mcp-testing.showCoverageReport is registered later with webview panels

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.exportCoverage', async () => {
      const format = await vscode.window.showQuickPick(['JSON', 'HTML', 'LCOV', 'Cobertura'], {
        placeHolder: 'Select export format',
      });
      if (format && mcpClient) {
        try {
          vscode.window.showInformationMessage(`Exporting coverage as ${format}...`);
          await mcpClient.exportCoverage(format.toLowerCase());
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to export coverage: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showCoverageGaps', async () => {
      if (mcpClient) {
        try {
          const gaps = await mcpClient.getCoverageGaps();
          vscode.window.showInformationMessage(`Found ${gaps.length} coverage gaps`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to get coverage gaps: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showCoverageTrends', async () => {
      vscode.window.showInformationMessage('Showing coverage trends...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.generateTestsFromCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage('Generating tests from code...');
          await mcpClient.generateTests(editor.document.uri.fsPath);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.generateFixtures', async () => {
      vscode.window.showInformationMessage('Generating test fixtures...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.suggestTestCases', async () => {
      vscode.window.showInformationMessage('Suggesting test cases...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.rerunLastTest', async () => {
      vscode.window.showInformationMessage('Rerunning last test...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.addTestTag', async () => {
      const tag = await vscode.window.showInputBox({
        prompt: 'Enter tag name',
        placeHolder: 'e.g., "integration", "slow", "critical"',
      });
      if (tag) {
        vscode.window.showInformationMessage(`Adding tag: ${tag}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.removeTestTag', async () => {
      const tag = await vscode.window.showInputBox({
        prompt: 'Enter tag name to remove',
        placeHolder: 'e.g., "integration", "slow", "critical"',
      });
      if (tag) {
        vscode.window.showInformationMessage(`Removing tag: ${tag}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runMutationTesting', async () => {
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage('Running mutation testing...');
          await mcpClient.runMutationTesting();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to run mutation testing: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.analyzeImpact', async () => {
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage('Analyzing test impact...');
          await mcpClient.analyzeImpact();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to analyze impact: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runAffectedTests', async () => {
      vscode.window.showInformationMessage('Running affected tests...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.benchmarkPerformance', async () => {
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage('Benchmarking test performance...');
          await mcpClient.benchmarkPerformance();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to benchmark performance: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showSlowTests', async () => {
      vscode.window.showInformationMessage('Showing slow tests...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.optimizeTest', async () => {
      vscode.window.showInformationMessage('Optimizing test...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.compareValues', async () => {
      vscode.window.showInformationMessage('Comparing values...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.watchTests', async () => {
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage('Starting watch mode...');
          await mcpClient.runTests({ watch: true });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to start watch mode: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.stopWatchMode', async () => {
      vscode.window.showInformationMessage('Stopping watch mode...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runTestsParallel', async () => {
      if (mcpClient) {
        try {
          vscode.window.showInformationMessage('Running tests in parallel...');
          await mcpClient.runTests({ parallel: true });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to run tests in parallel: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.configureFramework', async () => {
      vscode.window.showInformationMessage('Configuring test framework...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.selectFramework', async () => {
      const framework = await vscode.window.showQuickPick(
        ['Jest', 'Mocha', 'Pytest', 'Vitest', 'Auto-detect'],
        { placeHolder: 'Select test framework' }
      );
      if (framework) {
        vscode.window.showInformationMessage(`Selected framework: ${framework}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showFrameworkConfig', async () => {
      vscode.window.showInformationMessage('Showing framework configuration...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.stopTests', async () => {
      if (mcpClient) {
        // Stop tests logic here
        vscode.window.showInformationMessage('Tests stopped');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.refreshTests', async () => {
      if (testExplorer) {
        await testExplorer.refreshTests();
        vscode.window.showInformationMessage('Tests refreshed');
      } else {
        vscode.window.showInformationMessage('Test Explorer not initialized');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showCoverage', async () => {
      vscode.window.showInformationMessage(
        'Show coverage - Use Copilot with @testing for coverage analysis'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.toggleCoverage', async () => {
      if (coverageDecorator) {
        coverageDecorator.toggleCoverage();
      } else {
        vscode.window.showWarningMessage('Coverage decorator not initialized');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.generateTests', async () => {
      vscode.window.showInformationMessage(
        'Generate tests - Use Copilot with @testing for test generation'
      );
    })
  );

  // Webview panel commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showTestResults', async () => {
      if (!mcpClient) {
        vscode.window.showWarningMessage('MCP client not initialized');
        return;
      }

      try {
        const tests = await mcpClient.listTests();
        if (!testResultsPanel) {
          testResultsPanel = new TestResultsWebviewPanel(context, mcpClient, outputChannel);
        }
        await testResultsPanel.show(tests);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to show test results: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showCoverageReport', async () => {
      if (!mcpClient) {
        vscode.window.showWarningMessage('MCP client not initialized');
        return;
      }

      try {
        const tests = await mcpClient.listTests();
        const coverage = await mcpClient.analyzeCoverage(tests);
        if (!coverageReportPanel) {
          coverageReportPanel = new CoverageReportWebviewPanel(context, mcpClient, outputChannel);
        }
        await coverageReportPanel.show(coverage);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to show coverage report: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showTestGeneration', async () => {
      if (!mcpClient) {
        vscode.window.showWarningMessage('MCP client not initialized');
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      try {
        const tests = await mcpClient.generateTests(editor.document.uri.fsPath);
        if (!testGenerationPanel) {
          testGenerationPanel = new TestGenerationWebviewPanel(context, mcpClient, outputChannel);
        }
        await testGenerationPanel.show(tests);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to show test generation: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showMutationTesting', async () => {
      if (!mcpClient) {
        vscode.window.showWarningMessage('MCP client not initialized');
        return;
      }

      try {
        const report = await mcpClient.runMutationTesting();
        if (!mutationTestingPanel) {
          mutationTestingPanel = new MutationTestingWebviewPanel(context, mcpClient, outputChannel);
        }
        await mutationTestingPanel.show(report);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to show mutation testing: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showTestImpact', async () => {
      if (!mcpClient) {
        vscode.window.showWarningMessage('MCP client not initialized');
        return;
      }

      try {
        const analysis = await mcpClient.analyzeImpact();
        if (!testImpactPanel) {
          testImpactPanel = new TestImpactWebviewPanel(context, mcpClient, outputChannel);
        }
        await testImpactPanel.show(analysis);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to show test impact: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.showTestPerformance', async () => {
      if (!mcpClient) {
        vscode.window.showWarningMessage('MCP client not initialized');
        return;
      }

      try {
        const report = await mcpClient.benchmarkPerformance();
        if (!testPerformancePanel) {
          testPerformancePanel = new TestPerformanceWebviewPanel(context, mcpClient, outputChannel);
        }
        await testPerformancePanel.show(report);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to show test performance: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.rerunFailedTests', async () => {
      vscode.window.showInformationMessage('Rerunning failed tests...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.restartServer', async () => {
      if (mcpClient) {
        await mcpClient.reconnect();
        vscode.window.showInformationMessage('Server restarted');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'mcp-testing');
    })
  );

  // Tree view commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.clearHistory', async () => {
      if (testHistoryProvider) {
        testHistoryProvider.clearHistory();
        vscode.window.showInformationMessage('Test history cleared');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.exportHistory', async () => {
      if (testHistoryProvider) {
        const history = testHistoryProvider.exportHistory();
        const json = JSON.stringify(history, null, 2);
        const doc = await vscode.workspace.openTextDocument({
          content: json,
          language: 'json',
        });
        await vscode.window.showTextDocument(doc);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.compareRuns',
      async (run1Id: string, run2Id: string) => {
        if (testHistoryProvider) {
          testHistoryProvider.compareRuns(run1Id, run2Id);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.toggleShowOnlyUncovered', async () => {
      if (coverageProvider) {
        coverageProvider.toggleShowOnlyUncovered();
        vscode.window.showInformationMessage('Toggled show only uncovered code');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.navigateToUncovered', async () => {
      if (coverageProvider) {
        await coverageProvider.navigateToUncovered();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.generateTestsForUncovered',
      async (filePath: string) => {
        if (coverageProvider) {
          await coverageProvider.generateTestsForUncovered(filePath);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.detectFlakyTests', async () => {
      if (flakyTestsProvider) {
        const iterations = await vscode.window.showInputBox({
          prompt: 'Number of iterations to run each test',
          value: '10',
          validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 2 || num > 100) {
              return 'Please enter a number between 2 and 100';
            }
            return null;
          },
        });

        if (iterations) {
          await flakyTestsProvider.detectFlakyTests(parseInt(iterations));
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.applyFix', async (test: any, fix: any) => {
      // Apply fix to test
      vscode.window.showInformationMessage(`Applying fix: ${fix.type}`);
      // TODO: Implement fix application
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.manageTestTags', async (testId?: string) => {
      if (testTagsProvider) {
        await testTagsProvider.showTagManagementDialog(testId);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.runTestsWithTag', async (tag: string) => {
      if (testTagsProvider) {
        await testTagsProvider.runTestsWithTag(tag);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.refreshTreeViews', async () => {
      if (testHistoryProvider) {
        testHistoryProvider.refresh();
      }
      if (coverageProvider) {
        coverageProvider.refresh();
      }
      if (flakyTestsProvider) {
        flakyTestsProvider.refresh();
      }
      if (testTagsProvider) {
        testTagsProvider.refresh();
      }
      vscode.window.showInformationMessage('Tree views refreshed');
    })
  );

  // CodeLens commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.runTestAtCursor',
      async (uri: vscode.Uri, testFunc: any) => {
        if (mcpClient && testFunc.testId) {
          try {
            vscode.window.showInformationMessage(`Running test: ${testFunc.name}`);
            await mcpClient.runTests({ testPath: uri.fsPath });
            if (codeLensProvider) {
              codeLensProvider.refresh();
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to run test: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        } else {
          vscode.window.showWarningMessage('Test not found or MCP client not initialized');
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.debugTestAtCursor',
      async (uri: vscode.Uri, testFunc: any) => {
        if (mcpClient && testFunc.testId) {
          try {
            vscode.window.showInformationMessage(`Debugging test: ${testFunc.name}`);
            await mcpClient.debugTest(testFunc.testId);
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to debug test: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        } else {
          vscode.window.showWarningMessage('Test not found or MCP client not initialized');
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.showCoverageForTest',
      async (uri: vscode.Uri, testFunc: any) => {
        vscode.window.showInformationMessage(
          `Coverage for ${testFunc.name}: ${testFunc.coveragePercentage?.toFixed(1)}%`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.showTestResult',
      async (uri: vscode.Uri, testFunc: any) => {
        const status = testFunc.status || 'unknown';
        const duration = testFunc.duration ? `${testFunc.duration}ms` : 'N/A';
        vscode.window.showInformationMessage(
          `Test: ${testFunc.name}\nStatus: ${status}\nDuration: ${duration}`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.refreshCodeLens', async () => {
      if (codeLensProvider) {
        codeLensProvider.refresh();
        vscode.window.showInformationMessage('CodeLens refreshed');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.clearDiagnostics', async () => {
      if (diagnosticsProvider) {
        diagnosticsProvider.clearAllDiagnostics();
        vscode.window.showInformationMessage('Diagnostics cleared');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcp-testing.refreshDiagnostics', async () => {
      if (diagnosticsProvider) {
        await diagnosticsProvider.refreshDiagnostics();
        vscode.window.showInformationMessage('Diagnostics refreshed');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.analyzeFailure',
      async (uri: vscode.Uri, line: number) => {
        if (mcpClient) {
          try {
            // Find test at this line
            const tests = await mcpClient.listTests();
            const test = tests.find((t) => t.file === uri.fsPath && t.line === line + 1);

            if (test) {
              const analysis = await mcpClient.analyzeFailure(test.id);
              vscode.window.showInformationMessage(
                `Failure analysis: ${JSON.stringify(analysis, null, 2)}`
              );
            } else {
              vscode.window.showWarningMessage('Test not found at this location');
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to analyze failure: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.analyzeFlakyTest',
      async (uri: vscode.Uri, line: number) => {
        if (flakyTestsProvider) {
          // Find test at this line
          const tests = await mcpClient?.listTests();
          const test = tests?.find((t) => t.file === uri.fsPath && t.line === line + 1);

          if (test) {
            await flakyTestsProvider.analyzeFlakyTest(test.id);
          } else {
            vscode.window.showWarningMessage('Test not found at this location');
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'mcp-testing.suggestFlakyFixes',
      async (uri: vscode.Uri, line: number) => {
        vscode.window.showInformationMessage('Suggesting fixes for flaky test...');
        // TODO: Implement flaky test fix suggestions
      }
    )
  );

  console.log('[MCP ACS Testing] ✓ All commands registered successfully');
  outputChannel.appendLine('✓ All commands registered successfully');
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
