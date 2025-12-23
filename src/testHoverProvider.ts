/**
 * TestHoverProvider - Provides hover information for tests
 *
 * Shows test information, coverage details, and test history on hover
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult, CoverageReport } from './mcpClient';
import { LogOutputChannel } from '@ai-capabilities-suite/mcp-client-base';

/**
 * TestHoverProvider
 *
 * Implements vscode.HoverProvider to show test information on hover
 */
export class TestHoverProvider implements vscode.HoverProvider {
  private mcpClient: MCPTestingClient;
  private outputChannel: LogOutputChannel;
  private testCache: Map<string, TestResult[]> = new Map();
  private coverageCache: Map<string, any> = new Map();
  private testHistoryCache: Map<string, TestResult[]> = new Map();

  constructor(mcpClient: MCPTestingClient, outputChannel: LogOutputChannel) {
    this.mcpClient = mcpClient;
    this.outputChannel = outputChannel;

    // Listen for test updates
    this.mcpClient.onTestCompleted((test) => {
      this.updateTestCache(test);
    });

    // Listen for coverage updates
    this.mcpClient.onCoverageUpdated((coverage) => {
      this.updateCoverageCache(coverage);
    });
  }

  /**
   * Provide hover information
   */
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    try {
      const filePath = document.uri.fsPath;
      const line = position.line + 1; // VS Code uses 0-based lines

      // Check if this is a test file
      if (!this.isTestFile(filePath)) {
        // Show coverage information for non-test files
        return await this.provideCoverageHover(filePath, line, document, position);
      }

      // Get test at this location
      const test = await this.getTestAtLocation(filePath, line);
      if (!test) {
        return undefined;
      }

      // Build hover content
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;
      markdown.supportHtml = true;

      // Test information
      markdown.appendMarkdown(`### 🧪 Test: ${test.name}\n\n`);
      markdown.appendMarkdown(`**Status:** ${this.getStatusIcon(test.status)} ${test.status}\n\n`);
      markdown.appendMarkdown(`**Duration:** ${test.duration}ms\n\n`);

      if (test.suite && test.suite.length > 0) {
        markdown.appendMarkdown(`**Suite:** ${test.suite.join(' > ')}\n\n`);
      }

      if (test.tags && test.tags.length > 0) {
        markdown.appendMarkdown(`**Tags:** ${test.tags.join(', ')}\n\n`);
      }

      // Show error if test failed
      if (test.status === 'failed' && test.error) {
        markdown.appendMarkdown(`---\n\n`);
        markdown.appendMarkdown(`**Error:**\n\n`);
        markdown.appendCodeblock(test.error.message, 'text');

        if (test.error.expected && test.error.actual) {
          markdown.appendMarkdown(`\n**Expected:** \`${JSON.stringify(test.error.expected)}\`\n\n`);
          markdown.appendMarkdown(`**Actual:** \`${JSON.stringify(test.error.actual)}\`\n\n`);
        }
      }

      // Show coverage details
      const coverage = await this.getCoverageForTest(test);
      if (coverage) {
        markdown.appendMarkdown(`---\n\n`);
        markdown.appendMarkdown(`### 📊 Coverage\n\n`);
        markdown.appendMarkdown(
          `**Lines:** ${coverage.lines.covered}/${
            coverage.lines.total
          } (${coverage.lines.percentage.toFixed(1)}%)\n\n`
        );
        markdown.appendMarkdown(
          `**Branches:** ${coverage.branches.covered}/${
            coverage.branches.total
          } (${coverage.branches.percentage.toFixed(1)}%)\n\n`
        );
        markdown.appendMarkdown(
          `**Functions:** ${coverage.functions.covered}/${
            coverage.functions.total
          } (${coverage.functions.percentage.toFixed(1)}%)\n\n`
        );
      }

      // Show test history
      const history = await this.getTestHistory(test.id);
      if (history && history.length > 0) {
        markdown.appendMarkdown(`---\n\n`);
        markdown.appendMarkdown(
          `### 📜 Recent History (last ${Math.min(5, history.length)} runs)\n\n`
        );

        for (let i = 0; i < Math.min(5, history.length); i++) {
          const run = history[i];
          const timestamp = new Date(run.timestamp).toLocaleString();
          markdown.appendMarkdown(
            `- ${this.getStatusIcon(run.status)} ${run.status} (${run.duration}ms) - ${timestamp}\n`
          );
        }
      }

      // Quick actions
      markdown.appendMarkdown(`\n---\n\n`);
      markdown.appendMarkdown(
        `[▶️ Run Test](command:mcp-testing.runTestAtCursor?${encodeURIComponent(
          JSON.stringify([document.uri, test])
        )}) | `
      );
      markdown.appendMarkdown(
        `[🐛 Debug Test](command:mcp-testing.debugTestAtCursor?${encodeURIComponent(
          JSON.stringify([document.uri, test])
        )}) | `
      );
      markdown.appendMarkdown(
        `[📊 Show Coverage](command:mcp-testing.showCoverageForTest?${encodeURIComponent(
          JSON.stringify([document.uri, test])
        )})`
      );

      return new vscode.Hover(markdown);
    } catch (error) {
      this.outputChannel.error(
        `Failed to provide hover: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Provide coverage hover for non-test files
   */
  private async provideCoverageHover(
    filePath: string,
    line: number,
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    try {
      const coverage = this.coverageCache.get(filePath);
      if (!coverage || !coverage.lines) {
        return undefined;
      }

      const lineCoverage = coverage.lines[line];
      if (!lineCoverage) {
        return undefined;
      }

      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;

      if (lineCoverage.covered) {
        markdown.appendMarkdown(`### ✅ Line Covered\n\n`);
        markdown.appendMarkdown(`**Hits:** ${lineCoverage.hits}\n\n`);

        // Show which tests cover this line
        const coveringTests = await this.getTestsCoveringLine(filePath, line);
        if (coveringTests && coveringTests.length > 0) {
          markdown.appendMarkdown(`**Covered by ${coveringTests.length} test(s):**\n\n`);
          for (const test of coveringTests.slice(0, 5)) {
            markdown.appendMarkdown(`- ${test.name} (${test.file})\n`);
          }
          if (coveringTests.length > 5) {
            markdown.appendMarkdown(`\n_...and ${coveringTests.length - 5} more_\n`);
          }
        }
      } else {
        markdown.appendMarkdown(`### ❌ Line Not Covered\n\n`);
        markdown.appendMarkdown(`This line has not been executed by any tests.\n\n`);
        markdown.appendMarkdown(
          `[🔧 Generate Tests](command:mcp-testing.generateTestsForUncovered?${encodeURIComponent(
            JSON.stringify([filePath])
          )})`
        );
      }

      return new vscode.Hover(markdown);
    } catch (error) {
      this.outputChannel.error(
        `Failed to provide coverage hover: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\.(ts|js|tsx|jsx)$/,
      /\.spec\.(ts|js|tsx|jsx)$/,
      /_test\.(ts|js|tsx|jsx)$/,
      /test_.*\.py$/,
      /.*_test\.py$/,
    ];

    return testPatterns.some((pattern) => pattern.test(filePath));
  }

  /**
   * Get test at specific location
   */
  private async getTestAtLocation(filePath: string, line: number): Promise<TestResult | undefined> {
    try {
      // Check cache first
      let tests = this.testCache.get(filePath);

      if (!tests) {
        // Fetch tests from server
        const allTests = await this.mcpClient.listTests();
        tests = allTests.filter((t) => t.file === filePath);
        this.testCache.set(filePath, tests);
      }

      // Find test at or near this line
      // Look for test within 5 lines (to account for multi-line test definitions)
      return tests.find((t) => Math.abs(t.line - line) <= 5);
    } catch (error) {
      this.outputChannel.error(
        `Failed to get test at location: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Get coverage for a specific test
   */
  private async getCoverageForTest(test: TestResult): Promise<any | undefined> {
    try {
      // Get coverage from cache or server
      const coverage = this.coverageCache.get(test.file);
      if (coverage) {
        return coverage;
      }

      // Fetch coverage from server
      const allTests = await this.mcpClient.listTests();
      const coverageReport = await this.mcpClient.analyzeCoverage(allTests);

      if (coverageReport.files && coverageReport.files[test.file]) {
        const fileCoverage = coverageReport.files[test.file];
        this.coverageCache.set(test.file, fileCoverage);
        return fileCoverage.metrics;
      }

      return undefined;
    } catch (error) {
      this.outputChannel.error(
        `Failed to get coverage for test: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Get test history
   */
  private async getTestHistory(testId: string): Promise<TestResult[] | undefined> {
    try {
      // Check cache first
      const cached = this.testHistoryCache.get(testId);
      if (cached) {
        return cached;
      }

      // In a real implementation, this would fetch from the server
      // For now, return undefined as history tracking is not yet implemented
      return undefined;
    } catch (error) {
      this.outputChannel.error(
        `Failed to get test history: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Get tests covering a specific line
   */
  private async getTestsCoveringLine(
    filePath: string,
    line: number
  ): Promise<TestResult[] | undefined> {
    try {
      // In a real implementation, this would query the server for tests covering this line
      // For now, return undefined
      return undefined;
    } catch (error) {
      this.outputChannel.error(
        `Failed to get tests covering line: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed':
        return '✅';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⏭️';
      case 'pending':
        return '⏳';
      case 'running':
        return '▶️';
      default:
        return '❓';
    }
  }

  /**
   * Update test cache
   */
  private updateTestCache(test: TestResult): void {
    const tests = this.testCache.get(test.file) || [];
    const index = tests.findIndex((t) => t.id === test.id);

    if (index >= 0) {
      tests[index] = test;
    } else {
      tests.push(test);
    }

    this.testCache.set(test.file, tests);

    // Update history
    const history = this.testHistoryCache.get(test.id) || [];
    history.unshift(test);
    // Keep only last 10 runs
    if (history.length > 10) {
      history.pop();
    }
    this.testHistoryCache.set(test.id, history);
  }

  /**
   * Update coverage cache
   */
  private updateCoverageCache(coverage: CoverageReport): void {
    if (coverage.files) {
      for (const [filePath, fileCoverage] of Object.entries(coverage.files)) {
        this.coverageCache.set(filePath, fileCoverage);
      }
    }
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.testCache.clear();
    this.coverageCache.clear();
    this.testHistoryCache.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCaches();
  }
}
