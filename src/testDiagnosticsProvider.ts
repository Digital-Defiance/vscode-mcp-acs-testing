/**
 * TestDiagnosticsProvider - Diagnostics provider for test failures and coverage gaps
 *
 * Provides inline diagnostics for test failures, coverage gaps, and flaky tests
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult, CoverageReport } from './mcpClient';

/**
 * Diagnostic severity mapping
 */
const DIAGNOSTIC_SOURCE = 'mcp-testing';

/**
 * Flaky test information
 */
interface FlakyTest {
  testId: string;
  testName: string;
  file: string;
  line: number;
  failureRate: number;
  totalRuns: number;
  failures: number;
}

/**
 * Coverage gap information
 */
interface CoverageGap {
  file: string;
  startLine: number;
  endLine: number;
  type: 'line' | 'branch' | 'function';
  suggestion: string;
}

/**
 * TestDiagnosticsProvider
 *
 * Manages diagnostics for test failures, coverage gaps, and flaky tests
 */
export class TestDiagnosticsProvider {
  private readonly diagnosticCollection: vscode.DiagnosticCollection;
  private readonly testFailureDiagnostics = new Map<string, vscode.Diagnostic[]>();
  private readonly coverageGapDiagnostics = new Map<string, vscode.Diagnostic[]>();
  private readonly flakyTestDiagnostics = new Map<string, vscode.Diagnostic[]>();

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    // Create diagnostic collection
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for test events
   */
  private setupEventListeners(): void {
    // Listen to test completed events
    this.mcpClient.onTestCompleted((test) => {
      if (test.status === 'failed') {
        this.addTestFailureDiagnostic(test);
      } else {
        // Clear diagnostics for passed tests
        this.clearTestDiagnostic(test);
      }
    });

    // Listen to coverage updated events
    this.mcpClient.onCoverageUpdated((coverage) => {
      this.updateCoverageDiagnostics(coverage);
    });
  }

  /**
   * Add diagnostic for test failure
   */
  private addTestFailureDiagnostic(test: TestResult): void {
    try {
      const uri = vscode.Uri.file(test.file);
      const line = Math.max(0, test.line - 1); // Convert to 0-based

      // Create diagnostic
      const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
      const message = test.error?.message || 'Test failed';
      const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);

      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostic.code = 'test-failure';

      // Add related information if available
      if (test.error?.stack) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(uri, range),
            test.error.stack
          ),
        ];
      }

      // Store diagnostic
      const fileKey = uri.toString();
      if (!this.testFailureDiagnostics.has(fileKey)) {
        this.testFailureDiagnostics.set(fileKey, []);
      }
      this.testFailureDiagnostics.get(fileKey)!.push(diagnostic);

      // Update diagnostic collection
      this.updateDiagnosticsForFile(uri);

      this.outputChannel.debug(
        `Added test failure diagnostic for ${test.name} at ${test.file}:${test.line}`
      );
    } catch (error) {
      this.outputChannel.error(
        `Failed to add test failure diagnostic: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clear diagnostic for a specific test
   */
  private clearTestDiagnostic(test: TestResult): void {
    try {
      const uri = vscode.Uri.file(test.file);
      const fileKey = uri.toString();

      // Remove diagnostics for this test
      const diagnostics = this.testFailureDiagnostics.get(fileKey);
      if (diagnostics) {
        const line = Math.max(0, test.line - 1);
        const filtered = diagnostics.filter((d) => d.range.start.line !== line);
        this.testFailureDiagnostics.set(fileKey, filtered);

        // Update diagnostic collection
        this.updateDiagnosticsForFile(uri);
      }
    } catch (error) {
      this.outputChannel.error(
        `Failed to clear test diagnostic: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update coverage diagnostics
   */
  private async updateCoverageDiagnostics(coverage: CoverageReport): Promise<void> {
    try {
      // Clear existing coverage diagnostics
      this.coverageGapDiagnostics.clear();

      // Get coverage gaps from MCP server
      const gaps = await this.mcpClient.getCoverageGaps();

      // Create diagnostics for each gap
      for (const gap of gaps as CoverageGap[]) {
        const uri = vscode.Uri.file(gap.file);
        const fileKey = uri.toString();

        // Create diagnostic
        const startLine = Math.max(0, gap.startLine - 1);
        const endLine = Math.max(0, gap.endLine - 1);
        const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

        const message = `Uncovered ${gap.type}: ${gap.suggestion}`;
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);

        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = 'coverage-gap';
        diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];

        // Store diagnostic
        if (!this.coverageGapDiagnostics.has(fileKey)) {
          this.coverageGapDiagnostics.set(fileKey, []);
        }
        this.coverageGapDiagnostics.get(fileKey)!.push(diagnostic);

        // Update diagnostic collection
        this.updateDiagnosticsForFile(uri);
      }

      this.outputChannel.debug(`Updated coverage diagnostics for ${gaps.length} gaps`);
    } catch (error) {
      this.outputChannel.error(
        `Failed to update coverage diagnostics: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Add diagnostic for flaky test
   */
  async addFlakyTestDiagnostic(flakyTest: FlakyTest): Promise<void> {
    try {
      const uri = vscode.Uri.file(flakyTest.file);
      const fileKey = uri.toString();
      const line = Math.max(0, flakyTest.line - 1);

      // Create diagnostic
      const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
      const message = `Flaky test detected: ${flakyTest.testName} (${flakyTest.failures}/${
        flakyTest.totalRuns
      } failures, ${(flakyTest.failureRate * 100).toFixed(1)}% failure rate)`;
      const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);

      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostic.code = 'flaky-test';

      // Store diagnostic
      if (!this.flakyTestDiagnostics.has(fileKey)) {
        this.flakyTestDiagnostics.set(fileKey, []);
      }
      this.flakyTestDiagnostics.get(fileKey)!.push(diagnostic);

      // Update diagnostic collection
      this.updateDiagnosticsForFile(uri);

      this.outputChannel.debug(`Added flaky test diagnostic for ${flakyTest.testName}`);
    } catch (error) {
      this.outputChannel.error(
        `Failed to add flaky test diagnostic: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Update diagnostics for a specific file
   */
  private updateDiagnosticsForFile(uri: vscode.Uri): void {
    const fileKey = uri.toString();

    // Combine all diagnostics for this file
    const allDiagnostics: vscode.Diagnostic[] = [
      ...(this.testFailureDiagnostics.get(fileKey) || []),
      ...(this.coverageGapDiagnostics.get(fileKey) || []),
      ...(this.flakyTestDiagnostics.get(fileKey) || []),
    ];

    // Update diagnostic collection
    this.diagnosticCollection.set(uri, allDiagnostics);
  }

  /**
   * Clear all diagnostics for a file
   */
  clearDiagnostics(uri: vscode.Uri): void {
    const fileKey = uri.toString();

    this.testFailureDiagnostics.delete(fileKey);
    this.coverageGapDiagnostics.delete(fileKey);
    this.flakyTestDiagnostics.delete(fileKey);

    this.diagnosticCollection.set(uri, []);

    this.outputChannel.debug(`Cleared diagnostics for ${uri.fsPath}`);
  }

  /**
   * Clear all diagnostics
   */
  clearAllDiagnostics(): void {
    this.testFailureDiagnostics.clear();
    this.coverageGapDiagnostics.clear();
    this.flakyTestDiagnostics.clear();

    this.diagnosticCollection.clear();

    this.outputChannel.debug('Cleared all diagnostics');
  }

  /**
   * Provide code actions for diagnostics
   */
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const codeActions: vscode.CodeAction[] = [];

    // Filter diagnostics from our source
    const ourDiagnostics = context.diagnostics.filter((d) => d.source === DIAGNOSTIC_SOURCE);

    for (const diagnostic of ourDiagnostics) {
      if (diagnostic.code === 'test-failure') {
        // Add code action to debug test
        const debugAction = new vscode.CodeAction('Debug Test', vscode.CodeActionKind.QuickFix);
        debugAction.command = {
          title: 'Debug Test',
          command: 'mcp-testing.debugTest',
          arguments: [document.uri, diagnostic.range.start.line],
        };
        debugAction.diagnostics = [diagnostic];
        codeActions.push(debugAction);

        // Add code action to rerun test
        const rerunAction = new vscode.CodeAction('Rerun Test', vscode.CodeActionKind.QuickFix);
        rerunAction.command = {
          title: 'Rerun Test',
          command: 'mcp-testing.runTests',
          arguments: [document.uri, diagnostic.range.start.line],
        };
        rerunAction.diagnostics = [diagnostic];
        codeActions.push(rerunAction);

        // Add code action to analyze failure
        const analyzeAction = new vscode.CodeAction(
          'Analyze Failure',
          vscode.CodeActionKind.QuickFix
        );
        analyzeAction.command = {
          title: 'Analyze Failure',
          command: 'mcp-testing.analyzeFailure',
          arguments: [document.uri, diagnostic.range.start.line],
        };
        analyzeAction.diagnostics = [diagnostic];
        codeActions.push(analyzeAction);
      } else if (diagnostic.code === 'coverage-gap') {
        // Add code action to generate tests
        const generateAction = new vscode.CodeAction(
          'Generate Tests',
          vscode.CodeActionKind.QuickFix
        );
        generateAction.command = {
          title: 'Generate Tests',
          command: 'mcp-testing.generateTests',
          arguments: [document.uri],
        };
        generateAction.diagnostics = [diagnostic];
        codeActions.push(generateAction);

        // Add code action to show coverage
        const showCoverageAction = new vscode.CodeAction(
          'Show Coverage Details',
          vscode.CodeActionKind.QuickFix
        );
        showCoverageAction.command = {
          title: 'Show Coverage Details',
          command: 'mcp-testing.showCoverage',
          arguments: [document.uri],
        };
        showCoverageAction.diagnostics = [diagnostic];
        codeActions.push(showCoverageAction);
      } else if (diagnostic.code === 'flaky-test') {
        // Add code action to analyze flaky test
        const analyzeAction = new vscode.CodeAction(
          'Analyze Flaky Test',
          vscode.CodeActionKind.QuickFix
        );
        analyzeAction.command = {
          title: 'Analyze Flaky Test',
          command: 'mcp-testing.analyzeFlakyTest',
          arguments: [document.uri, diagnostic.range.start.line],
        };
        analyzeAction.diagnostics = [diagnostic];
        codeActions.push(analyzeAction);

        // Add code action to suggest fixes
        const fixAction = new vscode.CodeAction('Suggest Fixes', vscode.CodeActionKind.QuickFix);
        fixAction.command = {
          title: 'Suggest Fixes',
          command: 'mcp-testing.suggestFlakyFixes',
          arguments: [document.uri, diagnostic.range.start.line],
        };
        fixAction.diagnostics = [diagnostic];
        codeActions.push(fixAction);
      }
    }

    return codeActions;
  }

  /**
   * Update diagnostics in real-time
   */
  async refreshDiagnostics(): Promise<void> {
    try {
      // Get all open text documents
      const documents = vscode.workspace.textDocuments;

      for (const document of documents) {
        // Update diagnostics for each document
        this.updateDiagnosticsForFile(document.uri);
      }

      this.outputChannel.debug('Refreshed diagnostics for all open documents');
    } catch (error) {
      this.outputChannel.error(
        `Failed to refresh diagnostics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.diagnosticCollection.dispose();
    this.testFailureDiagnostics.clear();
    this.coverageGapDiagnostics.clear();
    this.flakyTestDiagnostics.clear();
  }
}
