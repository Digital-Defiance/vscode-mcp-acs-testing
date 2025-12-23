/**
 * TestCodeLensProvider - CodeLens provider for test functions
 *
 * Provides inline "Run Test" and "Debug Test" links above test functions
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult } from './mcpClient';

/**
 * Test function information
 */
interface TestFunction {
  name: string;
  testId?: string;
  range: vscode.Range;
  status?: 'passed' | 'failed' | 'skipped' | 'running';
  duration?: number;
  coveragePercentage?: number;
}

/**
 * TestCodeLensProvider
 *
 * Implements vscode.CodeLensProvider to show test actions above test functions
 */
export class TestCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private testFunctions = new Map<string, TestFunction[]>();
  private runningTests = new Set<string>();
  private testResults = new Map<string, TestResult>();
  private coverageData = new Map<string, number>();

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    // Listen to test events
    this.setupEventListeners();

    // Listen to document changes
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.isTestFile(e.document)) {
        this.invalidateDocument(e.document);
      }
    });

    // Listen to active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && this.isTestFile(editor.document)) {
        this._onDidChangeCodeLenses.fire();
      }
    });
  }

  /**
   * Setup event listeners for test events
   */
  private setupEventListeners(): void {
    // Listen to test started events
    this.mcpClient.onTestStarted((test) => {
      this.runningTests.add(test.id);
      this._onDidChangeCodeLenses.fire();
    });

    // Listen to test completed events
    this.mcpClient.onTestCompleted((test) => {
      this.runningTests.delete(test.id);
      this.testResults.set(test.id, test);
      this._onDidChangeCodeLenses.fire();
    });

    // Listen to coverage updated events
    this.mcpClient.onCoverageUpdated((coverage) => {
      // Update coverage data for functions
      for (const [filePath, fileData] of Object.entries(coverage.files)) {
        if (fileData.functions) {
          for (const func of fileData.functions) {
            const key = `${filePath}:${func.name}`;
            this.coverageData.set(key, func.covered ? 100 : 0);
          }
        }
      }
      this._onDidChangeCodeLenses.fire();
    });
  }

  /**
   * Check if document is a test file
   */
  private isTestFile(document: vscode.TextDocument): boolean {
    const fileName = document.fileName.toLowerCase();
    return (
      fileName.includes('.test.') ||
      fileName.includes('.spec.') ||
      fileName.includes('_test.') ||
      fileName.includes('test_') ||
      fileName.endsWith('test.ts') ||
      fileName.endsWith('test.js') ||
      fileName.endsWith('test.py')
    );
  }

  /**
   * Invalidate cached test functions for a document
   */
  private invalidateDocument(document: vscode.TextDocument): void {
    this.testFunctions.delete(document.uri.toString());
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Provide CodeLens for a document
   */
  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (!this.isTestFile(document)) {
      return [];
    }

    // Get or detect test functions
    let testFunctions = this.testFunctions.get(document.uri.toString());
    if (!testFunctions) {
      testFunctions = await this.detectTestFunctions(document);
      this.testFunctions.set(document.uri.toString(), testFunctions);
    }

    const codeLenses: vscode.CodeLens[] = [];

    for (const testFunc of testFunctions) {
      // Create CodeLens for each test function
      const range = testFunc.range;

      // Run Test CodeLens
      const runLens = new vscode.CodeLens(range, {
        title: this.getRunTitle(testFunc),
        command: 'mcp-testing.runTestAtCursor',
        arguments: [document.uri, testFunc],
      });
      codeLenses.push(runLens);

      // Debug Test CodeLens
      const debugLens = new vscode.CodeLens(range, {
        title: '$(debug) Debug Test',
        command: 'mcp-testing.debugTestAtCursor',
        arguments: [document.uri, testFunc],
      });
      codeLenses.push(debugLens);

      // Coverage CodeLens (if coverage is enabled and available)
      if (testFunc.coveragePercentage !== undefined) {
        const coverageLens = new vscode.CodeLens(range, {
          title: `$(graph) Coverage: ${testFunc.coveragePercentage.toFixed(1)}%`,
          command: 'mcp-testing.showCoverageForTest',
          arguments: [document.uri, testFunc],
        });
        codeLenses.push(coverageLens);
      }

      // Status CodeLens (if test has been run)
      if (testFunc.status && testFunc.duration !== undefined) {
        const statusLens = new vscode.CodeLens(range, {
          title: this.getStatusTitle(testFunc),
          command: 'mcp-testing.showTestResult',
          arguments: [document.uri, testFunc],
        });
        codeLenses.push(statusLens);
      }
    }

    return codeLenses;
  }

  /**
   * Get title for Run Test CodeLens
   */
  private getRunTitle(testFunc: TestFunction): string {
    if (testFunc.testId && this.runningTests.has(testFunc.testId)) {
      return '$(loading~spin) Running...';
    }

    if (testFunc.status === 'passed') {
      return '$(check) Run Test';
    } else if (testFunc.status === 'failed') {
      return '$(error) Run Test';
    } else if (testFunc.status === 'skipped') {
      return '$(circle-slash) Run Test';
    }

    return '$(play) Run Test';
  }

  /**
   * Get title for status CodeLens
   */
  private getStatusTitle(testFunc: TestFunction): string {
    const duration = testFunc.duration !== undefined ? `${testFunc.duration}ms` : '';

    switch (testFunc.status) {
      case 'passed':
        return `$(check) Passed ${duration}`.trim();
      case 'failed':
        return `$(error) Failed ${duration}`.trim();
      case 'skipped':
        return `$(circle-slash) Skipped`;
      case 'running':
        return '$(loading~spin) Running...';
      default:
        return '';
    }
  }

  /**
   * Detect test functions in a document
   */
  private async detectTestFunctions(document: vscode.TextDocument): Promise<TestFunction[]> {
    const testFunctions: TestFunction[] = [];
    const text = document.getText();
    const languageId = document.languageId;

    try {
      // Detect test functions based on language
      if (
        languageId === 'typescript' ||
        languageId === 'javascript' ||
        languageId === 'typescriptreact' ||
        languageId === 'javascriptreact'
      ) {
        this.detectJavaScriptTests(document, text, testFunctions);
      } else if (languageId === 'python') {
        this.detectPythonTests(document, text, testFunctions);
      }

      // Try to match test functions with known tests from MCP server
      await this.matchTestFunctionsWithServer(document, testFunctions);
    } catch (error) {
      this.outputChannel.error(
        `Failed to detect test functions: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return testFunctions;
  }

  /**
   * Detect JavaScript/TypeScript test functions
   */
  private detectJavaScriptTests(
    document: vscode.TextDocument,
    text: string,
    testFunctions: TestFunction[]
  ): void {
    // Patterns for Jest, Mocha, Vitest
    const patterns = [
      /^\s*(it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/gm,
      /^\s*(it|test|describe)\s*\.\s*(only|skip)\s*\(\s*['"`]([^'"`]+)['"`]/gm,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const line = document.positionAt(match.index).line;
        const name = match[2] || match[3];

        if (name) {
          testFunctions.push({
            name,
            range: new vscode.Range(line, 0, line, 0),
          });
        }
      }
    }
  }

  /**
   * Detect Python test functions
   */
  private detectPythonTests(
    document: vscode.TextDocument,
    text: string,
    testFunctions: TestFunction[]
  ): void {
    // Pattern for pytest
    const pattern = /^\s*def\s+(test_\w+)\s*\(/gm;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = document.positionAt(match.index).line;
      const name = match[1];

      testFunctions.push({
        name,
        range: new vscode.Range(line, 0, line, 0),
      });
    }
  }

  /**
   * Match detected test functions with tests from MCP server
   */
  private async matchTestFunctionsWithServer(
    document: vscode.TextDocument,
    testFunctions: TestFunction[]
  ): Promise<void> {
    try {
      // Get tests for this file from MCP server
      const allTests = await this.mcpClient.listTests();
      const fileTests = allTests.filter((test) => test.file === document.fileName);

      // Match test functions with server tests
      for (const testFunc of testFunctions) {
        // Try to find matching test by name
        const matchingTest = fileTests.find(
          (test) => test.name === testFunc.name || test.fullName.includes(testFunc.name)
        );

        if (matchingTest) {
          testFunc.testId = matchingTest.id;

          // Get test result if available
          const result = this.testResults.get(matchingTest.id);
          if (result) {
            // Map 'pending' status to 'skipped' for CodeLens display
            testFunc.status = result.status === 'pending' ? 'skipped' : result.status;
            testFunc.duration = result.duration;
          }

          // Get coverage if available
          const coverageKey = `${document.fileName}:${testFunc.name}`;
          const coverage = this.coverageData.get(coverageKey);
          if (coverage !== undefined) {
            testFunc.coveragePercentage = coverage;
          }
        }
      }
    } catch (error) {
      // Silently fail - tests might not be discovered yet
      this.outputChannel.debug(
        `Could not match test functions with server: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Resolve CodeLens (optional)
   */
  resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    // CodeLens is already resolved in provideCodeLenses
    return codeLens;
  }

  /**
   * Refresh CodeLens for all documents
   */
  refresh(): void {
    this.testFunctions.clear();
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Refresh CodeLens for a specific document
   */
  refreshDocument(document: vscode.TextDocument): void {
    this.invalidateDocument(document);
  }

  /**
   * Update test status
   */
  updateTestStatus(testId: string, status: TestResult): void {
    this.testResults.set(testId, status);
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Clear test results
   */
  clearTestResults(): void {
    this.testResults.clear();
    this.runningTests.clear();
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
}
