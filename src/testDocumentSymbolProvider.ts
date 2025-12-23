/**
 * TestDocumentSymbolProvider - Provides document outline for test files
 *
 * Show test structure in outline view with test suites and cases
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult } from './mcpClient';
import { LogOutputChannel } from '@ai-capabilities-suite/mcp-client-base';

/**
 * TestDocumentSymbolProvider
 *
 * Implements vscode.DocumentSymbolProvider for test file outline
 */
export class TestDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private mcpClient: MCPTestingClient;
  private outputChannel: LogOutputChannel;
  private testCache: Map<string, TestResult[]> = new Map();

  constructor(mcpClient: MCPTestingClient, outputChannel: LogOutputChannel) {
    this.mcpClient = mcpClient;
    this.outputChannel = outputChannel;

    // Listen for test updates
    this.mcpClient.onTestCompleted((test) => {
      this.updateTestCache(test);
    });
  }

  /**
   * Provide document symbols
   */
  async provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentSymbol[] | undefined> {
    try {
      const filePath = document.uri.fsPath;

      // Only provide symbols for test files
      if (!this.isTestFile(filePath)) {
        return undefined;
      }

      // Parse test structure from document
      const symbols = await this.parseTestStructure(document);

      return symbols;
    } catch (error) {
      this.outputChannel.error(
        `Failed to provide document symbols: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
  }

  /**
   * Parse test structure from document
   */
  private async parseTestStructure(
    document: vscode.TextDocument
  ): Promise<vscode.DocumentSymbol[]> {
    const text = document.getText();
    const lines = text.split('\n');
    const symbols: vscode.DocumentSymbol[] = [];

    // Detect framework
    const framework = this.detectFramework(text);

    if (framework === 'jest' || framework === 'vitest' || framework === 'mocha') {
      // Parse JavaScript/TypeScript test structure
      return this.parseJSTestStructure(lines, document);
    } else if (framework === 'pytest') {
      // Parse Python test structure
      return this.parsePythonTestStructure(lines, document);
    }

    return symbols;
  }

  /**
   * Parse JavaScript/TypeScript test structure
   */
  private parseJSTestStructure(
    lines: string[],
    document: vscode.TextDocument
  ): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    const stack: Array<{ symbol: vscode.DocumentSymbol; endLine: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Match describe blocks
      const describeMatch = trimmed.match(/^(describe|context)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (describeMatch) {
        const name = describeMatch[2];
        const range = new vscode.Range(i, 0, i, line.length);
        const selectionRange = new vscode.Range(i, 0, i, line.length);

        const symbol = new vscode.DocumentSymbol(
          name,
          'Test Suite',
          vscode.SymbolKind.Class,
          range,
          selectionRange
        );

        // Find the end of this describe block
        const endLine = this.findBlockEnd(lines, i);
        symbol.range = new vscode.Range(i, 0, endLine, lines[endLine]?.length || 0);

        // Add to parent or root
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          parent.symbol.children.push(symbol);
        } else {
          symbols.push(symbol);
        }

        stack.push({ symbol, endLine });
        continue;
      }

      // Match test/it blocks
      const testMatch = trimmed.match(/^(test|it|specify)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (testMatch) {
        const name = testMatch[2];
        const range = new vscode.Range(i, 0, i, line.length);
        const selectionRange = new vscode.Range(i, 0, i, line.length);

        const symbol = new vscode.DocumentSymbol(
          name,
          'Test Case',
          vscode.SymbolKind.Method,
          range,
          selectionRange
        );

        // Find the end of this test block
        const endLine = this.findBlockEnd(lines, i);
        symbol.range = new vscode.Range(i, 0, endLine, lines[endLine]?.length || 0);

        // Add status icon if we have test results
        const test = this.findTestByName(document.uri.fsPath, name);
        if (test) {
          symbol.detail = this.getStatusIcon(test.status);
        }

        // Add to parent or root
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          parent.symbol.children.push(symbol);
        } else {
          symbols.push(symbol);
        }
        continue;
      }

      // Match beforeEach, afterEach, beforeAll, afterAll
      const hookMatch = trimmed.match(
        /^(beforeEach|afterEach|beforeAll|afterAll|before|after)\s*\(/
      );
      if (hookMatch) {
        const name = hookMatch[1];
        const range = new vscode.Range(i, 0, i, line.length);
        const selectionRange = new vscode.Range(i, 0, i, line.length);

        const symbol = new vscode.DocumentSymbol(
          name,
          'Test Hook',
          vscode.SymbolKind.Function,
          range,
          selectionRange
        );

        const endLine = this.findBlockEnd(lines, i);
        symbol.range = new vscode.Range(i, 0, endLine, lines[endLine]?.length || 0);

        // Add to parent or root
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          parent.symbol.children.push(symbol);
        } else {
          symbols.push(symbol);
        }
        continue;
      }

      // Pop stack if we've passed the end of a block
      while (stack.length > 0 && i > stack[stack.length - 1].endLine) {
        stack.pop();
      }
    }

    return symbols;
  }

  /**
   * Parse Python test structure
   */
  private parsePythonTestStructure(
    lines: string[],
    document: vscode.TextDocument
  ): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    let currentClass: vscode.DocumentSymbol | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Match test classes
      const classMatch = trimmed.match(/^class\s+(Test\w+)/);
      if (classMatch) {
        const name = classMatch[1];
        const range = new vscode.Range(i, 0, i, line.length);
        const selectionRange = new vscode.Range(i, 0, i, line.length);

        currentClass = new vscode.DocumentSymbol(
          name,
          'Test Class',
          vscode.SymbolKind.Class,
          range,
          selectionRange
        );

        // Find the end of this class
        const endLine = this.findPythonBlockEnd(lines, i);
        currentClass.range = new vscode.Range(i, 0, endLine, lines[endLine]?.length || 0);

        symbols.push(currentClass);
        continue;
      }

      // Match test functions
      const funcMatch = trimmed.match(/^def\s+(test_\w+)/);
      if (funcMatch) {
        const name = funcMatch[1];
        const range = new vscode.Range(i, 0, i, line.length);
        const selectionRange = new vscode.Range(i, 0, i, line.length);

        const symbol = new vscode.DocumentSymbol(
          name,
          'Test Function',
          vscode.SymbolKind.Method,
          range,
          selectionRange
        );

        // Find the end of this function
        const endLine = this.findPythonBlockEnd(lines, i);
        symbol.range = new vscode.Range(i, 0, endLine, lines[endLine]?.length || 0);

        // Add status icon if we have test results
        const test = this.findTestByName(document.uri.fsPath, name);
        if (test) {
          symbol.detail = this.getStatusIcon(test.status);
        }

        // Add to class or root
        if (currentClass) {
          currentClass.children.push(symbol);
        } else {
          symbols.push(symbol);
        }
        continue;
      }

      // Match fixtures
      const fixtureMatch = trimmed.match(/^@pytest\.fixture/);
      if (fixtureMatch && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const funcMatch = nextLine.match(/^def\s+(\w+)/);
        if (funcMatch) {
          const name = funcMatch[1];
          const range = new vscode.Range(i, 0, i, line.length);
          const selectionRange = new vscode.Range(i + 1, 0, i + 1, lines[i + 1].length);

          const symbol = new vscode.DocumentSymbol(
            name,
            'Fixture',
            vscode.SymbolKind.Function,
            range,
            selectionRange
          );

          const endLine = this.findPythonBlockEnd(lines, i + 1);
          symbol.range = new vscode.Range(i, 0, endLine, lines[endLine]?.length || 0);

          symbols.push(symbol);
          i++; // Skip the next line since we already processed it
          continue;
        }
      }

      // Reset current class if we've left its scope
      if (currentClass && line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
        currentClass = null;
      }
    }

    return symbols;
  }

  /**
   * Find the end of a JavaScript/TypeScript block
   */
  private findBlockEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      // Count braces
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i;
          }
        }
      }
    }

    return lines.length - 1;
  }

  /**
   * Find the end of a Python block
   */
  private findPythonBlockEnd(lines: string[], startLine: number): number {
    const startIndent = this.getIndentation(lines[startLine]);

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and comments
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }

      const indent = this.getIndentation(line);

      // If we find a line with same or less indentation, we've reached the end
      if (indent <= startIndent) {
        return i - 1;
      }
    }

    return lines.length - 1;
  }

  /**
   * Get indentation level
   */
  private getIndentation(line: string): number {
    let indent = 0;
    for (const char of line) {
      if (char === ' ') {
        indent++;
      } else if (char === '\t') {
        indent += 4; // Treat tab as 4 spaces
      } else {
        break;
      }
    }
    return indent;
  }

  /**
   * Detect test framework
   */
  private detectFramework(text: string): string {
    if (text.includes('from jest') || text.includes("'jest'") || text.includes('"jest"')) {
      return 'jest';
    }

    if (text.includes('from vitest') || text.includes("'vitest'") || text.includes('"vitest"')) {
      return 'vitest';
    }

    if (text.includes('from mocha') || text.includes("'mocha'") || text.includes('"mocha"')) {
      return 'mocha';
    }

    if (text.includes('import pytest') || text.includes('from pytest')) {
      return 'pytest';
    }

    // Default based on file extension
    return 'jest';
  }

  /**
   * Find test by name
   */
  private findTestByName(filePath: string, testName: string): TestResult | undefined {
    const tests = this.testCache.get(filePath);
    if (!tests) {
      return undefined;
    }

    return tests.find((t) => t.name === testName || t.fullName.includes(testName));
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed':
        return '✅ Passed';
      case 'failed':
        return '❌ Failed';
      case 'skipped':
        return '⏭️ Skipped';
      case 'pending':
        return '⏳ Pending';
      case 'running':
        return '▶️ Running';
      default:
        return '';
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
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.testCache.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCaches();
  }
}
