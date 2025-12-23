/**
 * TestReferenceProvider - Provides references between tests and code
 *
 * Find all tests referencing a function and all code referenced by a test
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MCPTestingClient, TestResult } from './mcpClient';
import { LogOutputChannel } from '@ai-capabilities-suite/mcp-client-base';

/**
 * TestReferenceProvider
 *
 * Implements vscode.ReferenceProvider for test-code references
 */
export class TestReferenceProvider implements vscode.ReferenceProvider {
  private mcpClient: MCPTestingClient;
  private outputChannel: LogOutputChannel;
  private testCache: Map<string, TestResult[]> = new Map();
  private coverageCache: Map<string, any> = new Map();

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
   * Provide references
   */
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    try {
      const filePath = document.uri.fsPath;
      const wordRange = document.getWordRangeAtPosition(position);
      if (!wordRange) {
        return undefined;
      }

      const word = document.getText(wordRange);

      // Check if this is a test file
      if (this.isTestFile(filePath)) {
        // Find all code referenced by this test
        return await this.findCodeReferencedByTest(document, position, word);
      } else {
        // Find all tests referencing this function
        return await this.findTestsReferencingFunction(document, position, word);
      }
    } catch (error) {
      this.outputChannel.error(
        `Failed to provide references: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Find all tests referencing a function
   */
  private async findTestsReferencingFunction(
    document: vscode.TextDocument,
    position: vscode.Position,
    functionName: string
  ): Promise<vscode.Location[]> {
    try {
      const filePath = document.uri.fsPath;
      const locations: vscode.Location[] = [];

      // Get all test files in workspace
      const testFiles = await this.findAllTestFiles();

      // Search each test file for references to this function
      for (const testFile of testFiles) {
        try {
          const testUri = vscode.Uri.file(testFile);
          const testDoc = await vscode.workspace.openTextDocument(testUri);
          const testText = testDoc.getText();
          const lines = testText.split('\n');

          // Check if test file imports from the implementation file
          const relativeImportPath = this.getRelativeImportPath(testFile, filePath);
          const hasImport = this.checkForImport(testText, relativeImportPath, functionName);

          if (hasImport) {
            // Find all references to the function in this test file
            const refs = this.findReferencesInText(lines, functionName);
            for (const ref of refs) {
              locations.push(new vscode.Location(testUri, new vscode.Position(ref.line, ref.col)));
            }
          }
        } catch (error) {
          // Skip files that can't be opened
          continue;
        }
      }

      // Also check coverage data to find tests that execute this function
      const coverageRefs = await this.findTestsCoveringFunction(filePath, position.line + 1);
      locations.push(...coverageRefs);

      return locations;
    } catch (error) {
      this.outputChannel.error(
        `Failed to find tests referencing function: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * Find all code referenced by a test
   */
  private async findCodeReferencedByTest(
    document: vscode.TextDocument,
    position: vscode.Position,
    testName: string
  ): Promise<vscode.Location[]> {
    try {
      const filePath = document.uri.fsPath;
      const locations: vscode.Location[] = [];

      // Get the test at this position
      const test = await this.getTestAtLocation(filePath, position.line + 1);
      if (!test) {
        return [];
      }

      // Parse imports in the test file
      const imports = await this.parseImports(document);

      // Find all imported symbols used in the test
      const testText = this.getTestText(document, position);
      const usedSymbols = this.findUsedSymbols(testText, imports);

      // Find definitions of used symbols
      for (const symbol of usedSymbols) {
        const symbolLocations = await this.findSymbolDefinitions(symbol);
        locations.push(...symbolLocations);
      }

      // Also check coverage data to find code executed by this test
      const coverageRefs = await this.findCodeCoveredByTest(test);
      locations.push(...coverageRefs);

      return locations;
    } catch (error) {
      this.outputChannel.error(
        `Failed to find code referenced by test: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * Find all test files in workspace
   */
  private async findAllTestFiles(): Promise<string[]> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
      }

      const testFiles: string[] = [];

      // Search for test files using glob patterns
      const patterns = [
        '**/*.test.{ts,js,tsx,jsx}',
        '**/*.spec.{ts,js,tsx,jsx}',
        '**/*_test.{ts,js,tsx,jsx}',
        '**/test_*.py',
        '**/*_test.py',
      ];

      for (const pattern of patterns) {
        const files = await vscode.workspace.findFiles(
          pattern,
          '**/node_modules/**',
          1000 // Limit to 1000 files
        );
        testFiles.push(...files.map((f) => f.fsPath));
      }

      return [...new Set(testFiles)]; // Remove duplicates
    } catch (error) {
      this.outputChannel.error(
        `Failed to find test files: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Get relative import path
   */
  private getRelativeImportPath(fromFile: string, toFile: string): string {
    const fromDir = path.dirname(fromFile);
    let relativePath = path.relative(fromDir, toFile);

    // Remove extension
    relativePath = relativePath.replace(/\.(ts|js|tsx|jsx|py)$/, '');

    // Convert to import path format
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }

    // Normalize path separators for imports
    relativePath = relativePath.replace(/\\/g, '/');

    return relativePath;
  }

  /**
   * Check for import in text
   */
  private checkForImport(text: string, importPath: string, symbolName: string): boolean {
    // Check for various import patterns
    const patterns = [
      new RegExp(`import\\s+.*${symbolName}.*from\\s+['"\`]${importPath}['"\`]`, 'i'),
      new RegExp(
        `import\\s+\\{[^}]*${symbolName}[^}]*\\}\\s+from\\s+['"\`]${importPath}['"\`]`,
        'i'
      ),
      new RegExp(`from\\s+${importPath}\\s+import\\s+.*${symbolName}`, 'i'), // Python
      new RegExp(`require\\s*\\(\\s*['"\`]${importPath}['"\`]\\s*\\)`, 'i'),
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  /**
   * Find references in text
   */
  private findReferencesInText(
    lines: string[],
    symbolName: string
  ): Array<{ line: number; col: number }> {
    const references: Array<{ line: number; col: number }> = [];

    // Pattern to match symbol usage (not in comments or strings)
    const pattern = new RegExp(`\\b${symbolName}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        continue;
      }

      let match;
      while ((match = pattern.exec(line)) !== null) {
        references.push({ line: i, col: match.index });
      }
    }

    return references;
  }

  /**
   * Find tests covering a function using coverage data
   */
  private async findTestsCoveringFunction(
    filePath: string,
    line: number
  ): Promise<vscode.Location[]> {
    try {
      const coverage = this.coverageCache.get(filePath);
      if (!coverage || !coverage.lines) {
        return [];
      }

      const lineCoverage = coverage.lines[line];
      if (!lineCoverage || !lineCoverage.covered) {
        return [];
      }

      // In a real implementation, coverage data would include which tests covered each line
      // For now, return empty array
      return [];
    } catch (error) {
      this.outputChannel.error(
        `Failed to find tests covering function: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * Get test at location
   */
  private async getTestAtLocation(filePath: string, line: number): Promise<TestResult | undefined> {
    try {
      let tests = this.testCache.get(filePath);

      if (!tests) {
        const allTests = await this.mcpClient.listTests();
        tests = allTests.filter((t) => t.file === filePath);
        this.testCache.set(filePath, tests);
      }

      return tests.find((t) => Math.abs(t.line - line) <= 5);
    } catch (error) {
      this.outputChannel.error(
        `Failed to get test at location: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  /**
   * Parse imports from document
   */
  private async parseImports(document: vscode.TextDocument): Promise<Map<string, string>> {
    const imports = new Map<string, string>();
    const text = document.getText();
    const lines = text.split('\n');

    // Parse ES6 imports
    const es6ImportPattern = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = es6ImportPattern.exec(text)) !== null) {
      const namedImports = match[1];
      const defaultImport = match[2];
      const modulePath = match[3];

      if (namedImports) {
        const symbols = namedImports.split(',').map((s) => s.trim());
        for (const symbol of symbols) {
          imports.set(symbol, modulePath);
        }
      }

      if (defaultImport) {
        imports.set(defaultImport, modulePath);
      }
    }

    // Parse Python imports
    const pythonImportPattern = /from\s+([^\s]+)\s+import\s+(.+)/g;
    while ((match = pythonImportPattern.exec(text)) !== null) {
      const modulePath = match[1];
      const symbols = match[2].split(',').map((s) => s.trim());
      for (const symbol of symbols) {
        imports.set(symbol, modulePath);
      }
    }

    return imports;
  }

  /**
   * Get test text
   */
  private getTestText(document: vscode.TextDocument, position: vscode.Position): string {
    const text = document.getText();
    const lines = text.split('\n');

    // Find test boundaries
    let startLine = position.line;
    let endLine = position.line;

    // Search backwards for test start
    for (let i = position.line; i >= 0; i--) {
      if (/^\s*(test|it|describe)\s*\(/.test(lines[i]) || /^\s*def\s+test_/.test(lines[i])) {
        startLine = i;
        break;
      }
    }

    // Search forwards for test end
    let braceCount = 0;
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (i > startLine && braceCount === 0) {
        endLine = i;
        break;
      }
    }

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  /**
   * Find used symbols in text
   */
  private findUsedSymbols(text: string, imports: Map<string, string>): Set<string> {
    const usedSymbols = new Set<string>();

    for (const [symbol, modulePath] of imports.entries()) {
      const pattern = new RegExp(`\\b${symbol}\\b`, 'g');
      if (pattern.test(text)) {
        usedSymbols.add(symbol);
      }
    }

    return usedSymbols;
  }

  /**
   * Find symbol definitions
   */
  private async findSymbolDefinitions(symbolName: string): Promise<vscode.Location[]> {
    try {
      // Use VS Code's built-in symbol search
      const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        symbolName
      );

      if (!symbols || symbols.length === 0) {
        return [];
      }

      return symbols.filter((s) => s.name === symbolName).map((s) => s.location);
    } catch (error) {
      this.outputChannel.error(
        `Failed to find symbol definitions: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * Find code covered by test
   */
  private async findCodeCoveredByTest(test: TestResult): Promise<vscode.Location[]> {
    try {
      // In a real implementation, this would use coverage data to find all lines executed by this test
      // For now, return empty array
      return [];
    } catch (error) {
      this.outputChannel.error(
        `Failed to find code covered by test: ${
          error instanceof Error ? error.message : String(error)
        }`
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
   * Update coverage cache
   */
  private updateCoverageCache(coverage: any): void {
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
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCaches();
  }
}
