/**
 * TestWorkspaceSymbolProvider - Provides workspace-wide test search
 *
 * Search tests across workspace with fuzzy search and quick navigation
 */

import * as vscode from 'vscode';
import { MCPTestingClient, TestResult } from './mcpClient';
import { LogOutputChannel } from '@ai-capabilities-suite/mcp-client-base';

/**
 * TestWorkspaceSymbolProvider
 *
 * Implements vscode.WorkspaceSymbolProvider for workspace-wide test search
 */
export class TestWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  private mcpClient: MCPTestingClient;
  private outputChannel: LogOutputChannel;
  private testCache: TestResult[] = [];
  private lastCacheUpdate: number = 0;
  private cacheTimeout: number = 30000; // 30 seconds

  constructor(mcpClient: MCPTestingClient, outputChannel: LogOutputChannel) {
    this.mcpClient = mcpClient;
    this.outputChannel = outputChannel;

    // Listen for test updates
    this.mcpClient.onTestCompleted((test) => {
      this.updateTestInCache(test);
    });

    // Initial cache load
    this.refreshCache();
  }

  /**
   * Provide workspace symbols
   */
  async provideWorkspaceSymbols(
    query: string,
    token: vscode.CancellationToken
  ): Promise<vscode.SymbolInformation[]> {
    try {
      // Refresh cache if needed
      await this.refreshCacheIfNeeded();

      // Filter tests based on query
      const matchingTests = this.fuzzySearch(query, this.testCache);

      // Convert to symbol information
      const symbols: vscode.SymbolInformation[] = [];

      for (const test of matchingTests) {
        const uri = vscode.Uri.file(test.file);
        const position = new vscode.Position(Math.max(0, test.line - 1), 0);
        const location = new vscode.Location(uri, position);

        // Determine symbol kind based on test type
        const kind = this.getSymbolKind(test);

        // Create container name from suite
        const containerName = test.suite.length > 0 ? test.suite.join(' > ') : '';

        // Add status to name
        const name = `${this.getStatusIcon(test.status)} ${test.name}`;

        const symbol = new vscode.SymbolInformation(name, kind, containerName, location);

        symbols.push(symbol);
      }

      return symbols;
    } catch (error) {
      this.outputChannel.error(
        `Failed to provide workspace symbols: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  /**
   * Resolve workspace symbol (optional, provides additional details)
   */
  async resolveWorkspaceSymbol(
    symbol: vscode.SymbolInformation,
    token: vscode.CancellationToken
  ): Promise<vscode.SymbolInformation> {
    // Add additional details if needed
    return symbol;
  }

  /**
   * Fuzzy search tests
   */
  private fuzzySearch(query: string, tests: TestResult[]): TestResult[] {
    if (!query || query.trim() === '') {
      // Return all tests if no query
      return tests.slice(0, 100); // Limit to 100 results
    }

    const lowerQuery = query.toLowerCase();
    const queryParts = lowerQuery.split(/\s+/);

    // Score each test
    const scored = tests.map((test) => {
      const score = this.calculateScore(test, queryParts);
      return { test, score };
    });

    // Filter and sort by score
    const filtered = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100) // Limit to 100 results
      .map((item) => item.test);

    return filtered;
  }

  /**
   * Calculate fuzzy match score
   */
  private calculateScore(test: TestResult, queryParts: string[]): number {
    let score = 0;

    const testName = test.name.toLowerCase();
    const fullName = test.fullName.toLowerCase();
    const fileName = test.file.toLowerCase();
    const suiteName = test.suite.join(' ').toLowerCase();

    for (const part of queryParts) {
      // Exact match in name (highest score)
      if (testName.includes(part)) {
        score += 100;
      }

      // Exact match in full name
      if (fullName.includes(part)) {
        score += 50;
      }

      // Exact match in suite
      if (suiteName.includes(part)) {
        score += 30;
      }

      // Match in file name
      if (fileName.includes(part)) {
        score += 20;
      }

      // Fuzzy match (consecutive characters)
      if (this.fuzzyMatch(testName, part)) {
        score += 10;
      }

      // Match in tags
      if (test.tags.some((tag) => tag.toLowerCase().includes(part))) {
        score += 15;
      }
    }

    // Boost score for recently run tests
    const now = Date.now();
    const testTime = new Date(test.timestamp).getTime();
    const ageInMinutes = (now - testTime) / (1000 * 60);

    if (ageInMinutes < 5) {
      score += 50; // Very recent
    } else if (ageInMinutes < 30) {
      score += 20; // Recent
    }

    // Boost score for failed tests (they might need attention)
    if (test.status === 'failed') {
      score += 30;
    }

    return score;
  }

  /**
   * Fuzzy match (checks if characters appear in order)
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIndex = 0;

    for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
      if (text[i] === pattern[patternIndex]) {
        patternIndex++;
      }
    }

    return patternIndex === pattern.length;
  }

  /**
   * Get symbol kind based on test
   */
  private getSymbolKind(test: TestResult): vscode.SymbolKind {
    // Use different kinds to visually distinguish test types
    if (test.suite.length > 0) {
      return vscode.SymbolKind.Method; // Test within a suite
    } else {
      return vscode.SymbolKind.Function; // Standalone test
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
   * Refresh cache if needed
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();

    if (now - this.lastCacheUpdate > this.cacheTimeout) {
      await this.refreshCache();
    }
  }

  /**
   * Refresh cache
   */
  private async refreshCache(): Promise<void> {
    try {
      this.outputChannel.info('Refreshing test cache for workspace symbol provider');
      const tests = await this.mcpClient.listTests();
      this.testCache = tests;
      this.lastCacheUpdate = Date.now();
      this.outputChannel.info(`Cached ${tests.length} tests`);
    } catch (error) {
      this.outputChannel.error(
        `Failed to refresh test cache: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update test in cache
   */
  private updateTestInCache(test: TestResult): void {
    const index = this.testCache.findIndex((t) => t.id === test.id);

    if (index >= 0) {
      this.testCache[index] = test;
    } else {
      this.testCache.push(test);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.testCache = [];
    this.lastCacheUpdate = 0;
  }

  /**
   * Force refresh
   */
  async forceRefresh(): Promise<void> {
    await this.refreshCache();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearCache();
  }
}
