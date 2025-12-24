/**
 * Command registration for MCP ACS Testing Manager
 *
 * This file contains all command registrations with safe handling for duplicate registrations.
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
import {
  TestResultsWebviewPanel,
  CoverageReportWebviewPanel,
  TestGenerationWebviewPanel,
  MutationTestingWebviewPanel,
  TestImpactWebviewPanel,
  TestPerformanceWebviewPanel,
} from './webviews';

export interface CommandRegistrationContext {
  context: vscode.ExtensionContext;
  outputChannel: vscode.LogOutputChannel;
  mcpClient?: MCPTestingClient;
  testExplorer?: TestExplorerProvider;
  testTreeProvider?: TestTreeProvider;
  testHistoryProvider?: TestHistoryTreeProvider;
  coverageProvider?: CoverageTreeProvider;
  flakyTestsProvider?: FlakyTestsTreeProvider;
  testTagsProvider?: TestTagsTreeProvider;
  codeLensProvider?: TestCodeLensProvider;
  diagnosticsProvider?: TestDiagnosticsProvider;
  coverageDecorator?: CoverageDecorator;
  testResultsPanel?: TestResultsWebviewPanel;
  coverageReportPanel?: CoverageReportWebviewPanel;
  testGenerationPanel?: TestGenerationWebviewPanel;
  mutationTestingPanel?: MutationTestingWebviewPanel;
  testImpactPanel?: TestImpactWebviewPanel;
  testPerformancePanel?: TestPerformanceWebviewPanel;
}

/**
 * Helper function to safely register commands
 * Handles duplicate registration errors gracefully
 */
function safeRegisterCommand(
  commandId: string,
  callback: (...args: any[]) => any,
  outputChannel: vscode.LogOutputChannel
): vscode.Disposable | undefined {
  try {
    return vscode.commands.registerCommand(commandId, callback);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists')) {
      outputChannel.warn(`Command ${commandId} already registered, skipping`);
      return undefined;
    }
    throw error;
  }
}

/**
 * Register all extension commands
 */
export function registerAllCommands(ctx: CommandRegistrationContext): void {
  const { context, outputChannel } = ctx;

  // Helper to add disposable if it exists
  const addDisposable = (disposable: vscode.Disposable | undefined) => {
    if (disposable) {
      context.subscriptions.push(disposable);
    }
  };

  outputChannel.info('Registering commands...');

  // ========== AI-FIRST ARCHITECTURE ==========
  // Direct users to VS Code's Testing view for test execution
  // Our extension provides AI-powered insights and analysis

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.runTests',
      async () => {
        vscode.window.showInformationMessage(
          "Use VS Code's built-in test runner (Testing view) or your test framework's extension to run tests. " +
            'MCP ACS Testing Manager provides AI-powered analysis and insights.'
        );
        vscode.commands.executeCommand('workbench.view.testing.focus');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.runAllTests',
      async () => {
        vscode.window.showInformationMessage(
          "Use VS Code's Testing view to run all tests. MCP ACS Testing Manager provides AI-powered insights."
        );
        vscode.commands.executeCommand('workbench.view.testing.focus');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.runTestFile',
      async () => {
        vscode.window.showInformationMessage(
          "Use VS Code's Testing view to run test files. MCP ACS Testing Manager provides AI-powered insights."
        );
        vscode.commands.executeCommand('workbench.view.testing.focus');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.runTestAtCursor',
      async () => {
        vscode.window.showInformationMessage(
          "Use VS Code's Testing view to run individual tests. MCP ACS Testing Manager provides AI-powered insights."
        );
        vscode.commands.executeCommand('workbench.view.testing.focus');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.runTestSuite',
      async () => {
        vscode.window.showInformationMessage(
          "Use VS Code's Testing view to run test suites. MCP ACS Testing Manager provides AI-powered insights."
        );
        vscode.commands.executeCommand('workbench.view.testing.focus');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.debugTest',
      async () => {
        vscode.window.showInformationMessage(
          "Use VS Code's Testing view to debug tests. MCP ACS Testing Manager provides AI-powered failure analysis."
        );
        vscode.commands.executeCommand('workbench.view.testing.focus');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.debugTestAtCursor',
      async () => {
        vscode.window.showInformationMessage(
          "Use VS Code's Testing view to debug tests. MCP ACS Testing Manager provides AI-powered failure analysis."
        );
        vscode.commands.executeCommand('workbench.view.testing.focus');
      },
      outputChannel
    )
  );

  // ========== TEST DISCOVERY & REFRESH ==========

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.refreshTests',
      async () => {
        if (ctx.testExplorer) {
          await ctx.testExplorer.refreshTests();
        }
        if (ctx.testTreeProvider) {
          await ctx.testTreeProvider.refresh();
        }
        vscode.window.showInformationMessage('Tests refreshed');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.searchTests',
      async () => {
        const query = await vscode.window.showInputBox({
          prompt: 'Enter search query for tests',
          placeHolder: 'e.g., "should handle errors"',
        });
        if (query && ctx.mcpClient) {
          try {
            const results = await ctx.mcpClient.searchTests(query);
            vscode.window.showInformationMessage(
              `Found ${results.length} tests matching "${query}"`
            );
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to search tests: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.filterTests',
      async () => {
        const filterType = await vscode.window.showQuickPick(
          ['Status', 'Duration', 'Tag', 'File'],
          { placeHolder: 'Select filter type' }
        );
        if (filterType) {
          vscode.window.showInformationMessage(`Filtering tests by ${filterType}`);
        }
      },
      outputChannel
    )
  );

  // ========== AI-POWERED TEST GENERATION ==========

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.generateTests',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor');
          return;
        }

        if (!ctx.mcpClient) {
          vscode.window.showWarningMessage('MCP Testing client not initialized');
          return;
        }

        try {
          vscode.window.showInformationMessage('Generating tests with AI...');
          const filePath = editor.document.uri.fsPath;
          const tests = await ctx.mcpClient.generateTests(filePath);

          vscode.window.showInformationMessage(`Generated ${tests.length} test suggestions`);

          // Show test generation panel
          if (ctx.testGenerationPanel) {
            await ctx.testGenerationPanel.show(tests);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.generateTestsFromCode',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor');
          return;
        }
        if (ctx.mcpClient) {
          try {
            vscode.window.showInformationMessage('Generating tests from code...');
            await ctx.mcpClient.generateTests(editor.document.uri.fsPath);
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.generateFixtures',
      async () => {
        vscode.window.showInformationMessage('Generating test fixtures...');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.suggestTestCases',
      async () => {
        vscode.window.showInformationMessage('Suggesting test cases...');
      },
      outputChannel
    )
  );

  // ========== COVERAGE ANALYSIS ==========

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.showCoverage',
      async () => {
        vscode.window.showInformationMessage(
          'Show coverage - Use Copilot with @testing for coverage analysis'
        );
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.toggleCoverage',
      async () => {
        if (ctx.coverageDecorator) {
          ctx.coverageDecorator.toggleCoverage();
        } else {
          vscode.window.showWarningMessage('Coverage decorator not initialized');
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.showCoverageGaps',
      async () => {
        if (ctx.mcpClient) {
          try {
            const gaps = await ctx.mcpClient.getCoverageGaps();
            vscode.window.showInformationMessage(`Found ${gaps.length} coverage gaps`);
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to get coverage gaps: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.showCoverageTrends',
      async () => {
        vscode.window.showInformationMessage('Showing coverage trends...');
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.exportCoverage',
      async () => {
        const format = await vscode.window.showQuickPick(['JSON', 'HTML', 'LCOV', 'Cobertura'], {
          placeHolder: 'Select export format',
        });
        if (format && ctx.mcpClient) {
          try {
            vscode.window.showInformationMessage(`Exporting coverage as ${format}...`);
            await ctx.mcpClient.exportCoverage(format.toLowerCase());
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to export coverage: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      },
      outputChannel
    )
  );

  // ========== SERVER MANAGEMENT ==========

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.restartServer',
      async () => {
        if (ctx.mcpClient) {
          await ctx.mcpClient.reconnect();
          vscode.window.showInformationMessage('Server restarted');
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.openSettings',
      async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'mcp-testing');
      },
      outputChannel
    )
  );

  // ========== TREE VIEW COMMANDS ==========

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.clearHistory',
      async () => {
        if (ctx.testHistoryProvider) {
          ctx.testHistoryProvider.clearHistory();
          vscode.window.showInformationMessage('Test history cleared');
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.exportHistory',
      async () => {
        if (ctx.testHistoryProvider) {
          const history = ctx.testHistoryProvider.exportHistory();
          const json = JSON.stringify(history, null, 2);
          const doc = await vscode.workspace.openTextDocument({
            content: json,
            language: 'json',
          });
          await vscode.window.showTextDocument(doc);
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.refreshTreeViews',
      async () => {
        if (ctx.testHistoryProvider) {
          ctx.testHistoryProvider.refresh();
        }
        if (ctx.coverageProvider) {
          ctx.coverageProvider.refresh();
        }
        if (ctx.flakyTestsProvider) {
          ctx.flakyTestsProvider.refresh();
        }
        if (ctx.testTagsProvider) {
          ctx.testTagsProvider.refresh();
        }
        vscode.window.showInformationMessage('Tree views refreshed');
      },
      outputChannel
    )
  );

  // ========== WEBVIEW PANELS ==========

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.showTestResults',
      async () => {
        if (!ctx.mcpClient) {
          vscode.window.showWarningMessage('MCP client not initialized');
          return;
        }

        try {
          const tests = await ctx.mcpClient.listTests();
          if (!ctx.testResultsPanel) {
            ctx.testResultsPanel = new TestResultsWebviewPanel(
              context,
              ctx.mcpClient,
              outputChannel
            );
          }
          await ctx.testResultsPanel.show(tests);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to show test results: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      },
      outputChannel
    )
  );

  addDisposable(
    safeRegisterCommand(
      'mcp-testing.showCoverageReport',
      async () => {
        if (!ctx.mcpClient) {
          vscode.window.showWarningMessage('MCP client not initialized');
          return;
        }

        try {
          const tests = await ctx.mcpClient.listTests();
          const coverage = await ctx.mcpClient.analyzeCoverage(tests);
          if (!ctx.coverageReportPanel) {
            ctx.coverageReportPanel = new CoverageReportWebviewPanel(
              context,
              ctx.mcpClient,
              outputChannel
            );
          }
          await ctx.coverageReportPanel.show(coverage);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to show coverage report: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      },
      outputChannel
    )
  );

  outputChannel.info('✓ All commands registered successfully');
}
