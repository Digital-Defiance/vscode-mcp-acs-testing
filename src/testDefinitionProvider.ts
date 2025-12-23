/**
 * TestDefinitionProvider - Provides navigation between tests and implementation
 *
 * Navigate from test to implementation and vice versa
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MCPTestingClient, TestResult } from './mcpClient';
import { LogOutputChannel } from '@ai-capabilities-suite/mcp-client-base';

/**
 * TestDefinitionProvider
 *
 * Implements vscode.DefinitionProvider for test-to-implementation navigation
 */
export class TestDefinitionProvider implements vscode.DefinitionProvider {
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
   * Provide definition locations
   */
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
    try {
      const filePath = document.uri.fsPath;
      const wordRange = document.getWordRangeAtPosition(position);
      if (!wordRange) {
        return undefined;
      }

      const word = document.getText(wordRange);

      // Check if this is a test file
      if (this.isTestFile(filePath)) {
        // Navigate from test to implementation
        return await this.navigateToImplementation(document, position, word);
      } else {
        // Navigate from implementation to tests
        return await this.navigateToTests(document, position, word);
      }
    } catch (error) {
      this.outputChannel.error(
        `Failed to provide definition: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Navigate from test to implementation
   */
  private async navigateToImplementation(
    document: vscode.TextDocument,
    position: vscode.Position,
    word: string
  ): Promise<vscode.Definition | undefined> {
    try {
      const filePath = document.uri.fsPath;

      // Get the corresponding implementation file
      const implFile = this.getImplementationFile(filePath);
      if (!implFile || !fs.existsSync(implFile)) {
        return undefined;
      }

      // Try to find the function/class in the implementation file
      const locations = await this.findSymbolInFile(implFile, word);
      if (locations.length > 0) {
        return locations;
      }

      // If not found, just open the implementation file at the top
      return new vscode.Location(vscode.Uri.file(implFile), new vscode.Position(0, 0));
    } catch (error) {
      this.outputChannel.error(
        `Failed to navigate to implementation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
  }

  /**
   * Navigate from implementation to tests
   */
  private async navigateToTests(
    document: vscode.TextDocument,
    position: vscode.Position,
    word: string
  ): Promise<vscode.Definition | undefined> {
    try {
      const filePath = document.uri.fsPath;

      // Get all test files for this implementation
      const testFiles = this.getTestFiles(filePath);
      if (testFiles.length === 0) {
        return undefined;
      }

      const locations: vscode.Location[] = [];

      // Search for tests related to this symbol
      for (const testFile of testFiles) {
        if (fs.existsSync(testFile)) {
          const testLocations = await this.findTestsForSymbol(testFile, word);
          locations.push(...testLocations);
        }
      }

      if (locations.length > 0) {
        return locations;
      }

      // If no specific tests found, just open the first test file
      if (testFiles.length > 0 && fs.existsSync(testFiles[0])) {
        return new vscode.Location(vscode.Uri.file(testFiles[0]), new vscode.Position(0, 0));
      }

      return undefined;
    } catch (error) {
      this.outputChannel.error(
        `Failed to navigate to tests: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Get implementation file from test file
   */
  private getImplementationFile(testFilePath: string): string | undefined {
    const dir = path.dirname(testFilePath);
    const basename = path.basename(testFilePath);

    // Remove test suffixes
    let implBasename = basename
      .replace(/\.test\.(ts|js|tsx|jsx)$/, '.$1')
      .replace(/\.spec\.(ts|js|tsx|jsx)$/, '.$1')
      .replace(/_test\.(ts|js|tsx|jsx)$/, '.$1')
      .replace(/test_(.*)\.py$/, '$1.py')
      .replace(/(.*)_test\.py$/, '$1.py');

    // Try different locations
    const candidates = [
      path.join(dir, implBasename), // Same directory
      path.join(dir, '..', implBasename), // Parent directory
      path.join(dir, '..', 'src', implBasename), // ../src
      path.join(dir, '..', 'lib', implBasename), // ../lib
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  /**
   * Get test files for implementation file
   */
  private getTestFiles(implFilePath: string): string[] {
    const dir = path.dirname(implFilePath);
    const basename = path.basename(implFilePath);
    const ext = path.extname(basename);
    const nameWithoutExt = basename.slice(0, -ext.length);

    const testFiles: string[] = [];

    // Generate possible test file names
    const testPatterns = [
      `${nameWithoutExt}.test${ext}`,
      `${nameWithoutExt}.spec${ext}`,
      `${nameWithoutExt}_test${ext}`,
      `test_${nameWithoutExt}${ext}`,
    ];

    // Try different locations
    const testDirs = [
      dir, // Same directory
      path.join(dir, '__tests__'), // __tests__ subdirectory
      path.join(dir, 'tests'), // tests subdirectory
      path.join(dir, '..', 'tests'), // ../tests
      path.join(dir, '..', '__tests__'), // ../__tests__
    ];

    for (const testDir of testDirs) {
      for (const pattern of testPatterns) {
        const testFile = path.join(testDir, pattern);
        if (fs.existsSync(testFile)) {
          testFiles.push(testFile);
        }
      }
    }

    return testFiles;
  }

  /**
   * Find symbol in file
   */
  private async findSymbolInFile(filePath: string, symbolName: string): Promise<vscode.Location[]> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();
      const lines = text.split('\n');

      const locations: vscode.Location[] = [];

      // Search for function/class/const declarations
      const patterns = [
        new RegExp(`^\\s*function\\s+${symbolName}\\s*\\(`, 'm'),
        new RegExp(`^\\s*const\\s+${symbolName}\\s*=`, 'm'),
        new RegExp(`^\\s*let\\s+${symbolName}\\s*=`, 'm'),
        new RegExp(`^\\s*var\\s+${symbolName}\\s*=`, 'm'),
        new RegExp(`^\\s*class\\s+${symbolName}\\s*`, 'm'),
        new RegExp(`^\\s*export\\s+function\\s+${symbolName}\\s*\\(`, 'm'),
        new RegExp(`^\\s*export\\s+const\\s+${symbolName}\\s*=`, 'm'),
        new RegExp(`^\\s*export\\s+class\\s+${symbolName}\\s*`, 'm'),
        new RegExp(`^\\s*def\\s+${symbolName}\\s*\\(`, 'm'), // Python
        new RegExp(`^\\s*class\\s+${symbolName}\\s*\\(`, 'm'), // Python class
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            const position = new vscode.Position(i, 0);
            locations.push(new vscode.Location(uri, position));
            break;
          }
        }
      }

      return locations;
    } catch (error) {
      this.outputChannel.error(
        `Failed to find symbol in file: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Find tests for symbol
   */
  private async findTestsForSymbol(
    testFilePath: string,
    symbolName: string
  ): Promise<vscode.Location[]> {
    try {
      const uri = vscode.Uri.file(testFilePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();
      const lines = text.split('\n');

      const locations: vscode.Location[] = [];

      // Search for test cases that mention the symbol
      const patterns = [
        new RegExp(`describe\\s*\\(\\s*['"\`].*${symbolName}.*['"\`]`, 'i'),
        new RegExp(`test\\s*\\(\\s*['"\`].*${symbolName}.*['"\`]`, 'i'),
        new RegExp(`it\\s*\\(\\s*['"\`].*${symbolName}.*['"\`]`, 'i'),
        new RegExp(`def\\s+test_.*${symbolName.toLowerCase()}`, 'i'), // Python
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            const position = new vscode.Position(i, 0);
            locations.push(new vscode.Location(uri, position));
            break;
          }
        }
      }

      // If no specific tests found, look for any imports of the symbol
      if (locations.length === 0) {
        const importPattern = new RegExp(`import.*${symbolName}`, 'i');
        for (let i = 0; i < lines.length; i++) {
          if (importPattern.test(lines[i])) {
            // Found import, return first test in file
            for (let j = i; j < lines.length; j++) {
              if (
                /^\s*(test|it|describe)\s*\(/.test(lines[j]) ||
                /^\s*def\s+test_/.test(lines[j])
              ) {
                const position = new vscode.Position(j, 0);
                locations.push(new vscode.Location(uri, position));
                break;
              }
            }
            break;
          }
        }
      }

      return locations;
    } catch (error) {
      this.outputChannel.error(
        `Failed to find tests for symbol: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
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
