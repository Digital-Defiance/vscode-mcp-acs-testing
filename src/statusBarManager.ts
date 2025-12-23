/**
 * Status Bar Manager for MCP ACS Testing Manager
 *
 * Manages status bar items for test status, coverage, and last run information.
 * Uses the shared status bar from @ai-capabilities-suite/vscode-shared-status-bar
 * for the main ACS status bar, and creates additional status bar items for
 * test-specific information.
 */

import * as vscode from 'vscode';
import {
  registerExtension,
  unregisterExtension,
  ExtensionMetadata,
  ExtensionAction,
} from '@ai-capabilities-suite/vscode-shared-status-bar';
import { MCPTestingClient } from './mcpClient';

/**
 * Test status for display
 */
export enum TestStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  ERROR = 'error',
}

/**
 * Status bar manager for MCP ACS Testing Manager
 */
export class StatusBarManager implements vscode.Disposable {
  private testStatusItem: vscode.StatusBarItem;
  private coverageItem: vscode.StatusBarItem;
  private lastRunItem: vscode.StatusBarItem;
  private currentStatus: TestStatus = TestStatus.IDLE;
  private currentCoverage: number | undefined;
  private lastRunTime: Date | undefined;
  private disposables: vscode.Disposable[] = [];
  private isRegistered = false;

  constructor(
    private mcpClient: MCPTestingClient | undefined,
    private outputChannel: vscode.LogOutputChannel
  ) {
    this.outputChannel.info('StatusBarManager constructor called');

    // Create test status item
    this.testStatusItem = vscode.window.createStatusBarItem(
      'mcp-testing.testStatus',
      vscode.StatusBarAlignment.Left,
      100
    );
    this.testStatusItem.name = 'MCP Testing: Test Status';
    this.testStatusItem.command = 'mcp-testing.showTestResults';
    this.disposables.push(this.testStatusItem);

    // Create coverage item
    this.coverageItem = vscode.window.createStatusBarItem(
      'mcp-testing.coverage',
      vscode.StatusBarAlignment.Left,
      99
    );
    this.coverageItem.name = 'MCP Testing: Coverage';
    this.coverageItem.command = 'mcp-testing.showCoverageReport';
    this.disposables.push(this.coverageItem);

    // Create last run item
    this.lastRunItem = vscode.window.createStatusBarItem(
      'mcp-testing.lastRun',
      vscode.StatusBarAlignment.Left,
      98
    );
    this.lastRunItem.name = 'MCP Testing: Last Run';
    this.lastRunItem.command = 'mcp-testing.showTestHistory';
    this.disposables.push(this.lastRunItem);

    // Initialize status bar items
    this.updateTestStatus(TestStatus.IDLE);
    this.updateCoverage(undefined);
    this.updateLastRun(undefined);

    this.outputChannel.info('About to register with shared status bar');

    // Register with shared status bar
    this.registerWithSharedStatusBar();

    this.outputChannel.info('StatusBarManager initialized');
  }

  /**
   * Register this extension with the shared ACS status bar
   */
  private async registerWithSharedStatusBar(): Promise<void> {
    this.outputChannel.info('registerWithSharedStatusBar called');
    try {
      const actions: ExtensionAction[] = [
        {
          label: '$(play) Run Tests',
          command: 'mcp-testing.runTests',
          description: 'Run all tests',
        },
        {
          label: '$(debug) Debug Test',
          command: 'mcp-testing.debugTest',
          description: 'Debug test at cursor',
        },
        {
          label: '$(graph) Show Coverage',
          command: 'mcp-testing.showCoverageReport',
          description: 'View coverage report',
        },
        {
          label: '$(wand) Generate Tests',
          command: 'mcp-testing.generateTests',
          description: 'Generate tests for current file',
        },
        {
          label: '$(refresh) Refresh Tests',
          command: 'mcp-testing.refreshTests',
          description: 'Refresh test list',
        },
      ];

      const metadata: ExtensionMetadata = {
        displayName: 'MCP ACS Testing Manager',
        status: this.getExtensionStatus(),
        actions,
        settingsQuery: 'mcp-testing',
      };

      this.outputChannel.info('Calling registerExtension with id: mcp-acs-testing');
      await registerExtension('mcp-acs-testing', metadata);
      this.isRegistered = true;
      this.outputChannel.info('✓ Successfully registered with shared ACS status bar');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.outputChannel.error(`✗ Failed to register with shared status bar: ${errorMessage}`);
      if (errorStack) {
        this.outputChannel.error(`Stack trace: ${errorStack}`);
      }

      // Show user-visible error
      vscode.window
        .showErrorMessage(
          `MCP Testing: Failed to register with status bar. Check output for details.`,
          'Show Output'
        )
        .then((selection) => {
          if (selection === 'Show Output') {
            this.outputChannel.show();
          }
        });
    }
  }

  /**
   * Set the MCP client (called after client is initialized)
   */
  public setMCPClient(client: MCPTestingClient): void {
    this.mcpClient = client;
    this.outputChannel.info('MCP client connected to StatusBarManager');
  }

  /**
   * Get the current extension status for the shared status bar
   */
  private getExtensionStatus(): 'ok' | 'warning' | 'error' {
    switch (this.currentStatus) {
      case TestStatus.ERROR:
      case TestStatus.FAILED:
        return 'error';
      case TestStatus.RUNNING:
        return 'warning';
      default:
        return 'ok';
    }
  }

  /**
   * Update test status
   */
  public updateTestStatus(status: TestStatus, passedCount?: number, failedCount?: number): void {
    this.currentStatus = status;

    let icon: string;
    let text: string;
    let color: string | undefined;
    let tooltip: string;

    switch (status) {
      case TestStatus.IDLE:
        icon = '$(beaker)';
        text = 'Tests';
        color = undefined;
        tooltip = 'No tests running. Click to view test results.';
        break;
      case TestStatus.RUNNING:
        icon = '$(sync~spin)';
        text = 'Running...';
        color = new vscode.ThemeColor('statusBarItem.warningBackground');
        tooltip = 'Tests are currently running...';
        break;
      case TestStatus.PASSED:
        icon = '$(pass)';
        text = passedCount !== undefined ? `${passedCount} Passed` : 'Passed';
        color = new vscode.ThemeColor('testing.iconPassed');
        tooltip = `All tests passed${
          passedCount !== undefined ? ` (${passedCount} tests)` : ''
        }. Click to view results.`;
        break;
      case TestStatus.FAILED:
        icon = '$(error)';
        text =
          failedCount !== undefined && passedCount !== undefined
            ? `${failedCount} Failed, ${passedCount} Passed`
            : failedCount !== undefined
            ? `${failedCount} Failed`
            : 'Failed';
        color = new vscode.ThemeColor('testing.iconFailed');
        tooltip = `Some tests failed${
          failedCount !== undefined ? ` (${failedCount} failures)` : ''
        }. Click to view results.`;
        break;
      case TestStatus.ERROR:
        icon = '$(warning)';
        text = 'Error';
        color = new vscode.ThemeColor('statusBarItem.errorBackground');
        tooltip = 'Test execution encountered an error. Click to view details.';
        break;
    }

    this.testStatusItem.text = `${icon} ${text}`;
    this.testStatusItem.backgroundColor = color;
    this.testStatusItem.tooltip = tooltip;
    this.testStatusItem.show();

    this.outputChannel.debug(`Test status updated: ${status}`);
  }

  /**
   * Update coverage percentage
   */
  public updateCoverage(coveragePercentage: number | undefined): void {
    this.currentCoverage = coveragePercentage;

    if (coveragePercentage === undefined) {
      this.coverageItem.hide();
      return;
    }

    // Get coverage thresholds from configuration
    const config = vscode.workspace.getConfiguration('mcp-testing');
    const thresholds = config.get<{
      lines: number;
      branches: number;
      functions: number;
      statements: number;
    }>('coverage.thresholds', {
      lines: 80,
      branches: 75,
      functions: 85,
      statements: 80,
    });

    // Use the lines threshold as the overall threshold
    const threshold = thresholds.lines;

    let icon: string;
    let color: string | undefined;
    let tooltip: string;

    if (coveragePercentage >= threshold) {
      icon = '$(pass)';
      color = new vscode.ThemeColor('testing.iconPassed');
      tooltip = `Coverage: ${coveragePercentage.toFixed(1)}% (above threshold of ${threshold}%)`;
    } else {
      icon = '$(warning)';
      color = new vscode.ThemeColor('statusBarItem.errorBackground');
      tooltip = `Coverage: ${coveragePercentage.toFixed(1)}% (below threshold of ${threshold}%)`;
    }

    this.coverageItem.text = `${icon} ${coveragePercentage.toFixed(1)}%`;
    this.coverageItem.backgroundColor = color;
    this.coverageItem.tooltip = tooltip;
    this.coverageItem.show();

    this.outputChannel.debug(`Coverage updated: ${coveragePercentage.toFixed(1)}%`);
  }

  /**
   * Update last run timestamp
   */
  public updateLastRun(timestamp: Date | undefined): void {
    this.lastRunTime = timestamp;

    if (!timestamp) {
      this.lastRunItem.hide();
      return;
    }

    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let timeAgo: string;
    if (diffMinutes < 1) {
      timeAgo = 'just now';
    } else if (diffMinutes < 60) {
      timeAgo = `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      timeAgo = `${diffHours}h ago`;
    } else {
      timeAgo = `${diffDays}d ago`;
    }

    this.lastRunItem.text = `$(history) ${timeAgo}`;
    this.lastRunItem.tooltip = `Last test run: ${timestamp.toLocaleString()}. Click to view test history.`;
    this.lastRunItem.show();

    this.outputChannel.debug(`Last run updated: ${timeAgo}`);
  }

  /**
   * Show all status bar items
   */
  public show(): void {
    this.testStatusItem.show();
    if (this.currentCoverage !== undefined) {
      this.coverageItem.show();
    }
    if (this.lastRunTime !== undefined) {
      this.lastRunItem.show();
    }
  }

  /**
   * Hide all status bar items
   */
  public hide(): void {
    this.testStatusItem.hide();
    this.coverageItem.hide();
    this.lastRunItem.hide();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    // Unregister from shared status bar
    if (this.isRegistered) {
      unregisterExtension('mcp-acs-testing').catch((error) => {
        this.outputChannel.error(
          `Failed to unregister from shared status bar: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    }

    // Dispose all status bar items
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];

    this.outputChannel.info('StatusBarManager disposed');
  }
}
