/**
 * CoverageDecorator - Coverage visualization in the editor
 *
 * Provides gutter decorations and hover information for code coverage
 */

import * as vscode from 'vscode';
import { MCPTestingClient, CoverageReport } from './mcpClient';

/**
 * File coverage information
 */
interface FileCoverage {
  path: string;
  metrics: {
    lines: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    statements: { total: number; covered: number; percentage: number };
  };
  lines: Record<number, LineCoverage>;
  branches: BranchCoverage[];
  functions: FunctionCoverage[];
}

/**
 * Line coverage information
 */
interface LineCoverage {
  line: number;
  hits: number;
  covered: boolean;
}

/**
 * Branch coverage information
 */
interface BranchCoverage {
  line: number;
  branch: number;
  taken: boolean;
}

/**
 * Function coverage information
 */
interface FunctionCoverage {
  name: string;
  line: number;
  hits: number;
  covered: boolean;
}

/**
 * Coverage threshold configuration
 */
interface CoverageThresholds {
  lines?: number;
  branches?: number;
  functions?: number;
  statements?: number;
}

/**
 * CoverageDecorator
 *
 * Manages coverage decorations in the editor
 */
export class CoverageDecorator {
  private readonly coveredDecorationType: vscode.TextEditorDecorationType;
  private readonly uncoveredDecorationType: vscode.TextEditorDecorationType;
  private readonly partiallyCoveredDecorationType: vscode.TextEditorDecorationType;
  private readonly coverageData = new Map<string, FileCoverage>();
  private coverageEnabled = false;
  private heatMapMode = false;
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private readonly mcpClient: MCPTestingClient,
    private readonly outputChannel: vscode.LogOutputChannel
  ) {
    // Create decoration types for covered lines (green)
    this.coveredDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createGutterIcon('green'),
      gutterIconSize: 'contain',
      backgroundColor: new vscode.ThemeColor('testing.coverageGreen'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('testing.coverageGreen'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Create decoration types for uncovered lines (red)
    this.uncoveredDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createGutterIcon('red'),
      gutterIconSize: 'contain',
      backgroundColor: new vscode.ThemeColor('testing.coverageRed'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('testing.coverageRed'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Create decoration types for partially covered lines (yellow)
    this.partiallyCoveredDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createGutterIcon('yellow'),
      gutterIconSize: 'contain',
      backgroundColor: new vscode.ThemeColor('testing.coverageYellow'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('testing.coverageYellow'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'mcp-testing.toggleCoverage';
    this.statusBarItem.tooltip = 'Click to toggle coverage display';

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Create a gutter icon for coverage
   */
  private createGutterIcon(color: 'green' | 'red' | 'yellow'): vscode.Uri {
    // Create SVG data URI for gutter icon
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect width="4" height="16" fill="${color}" />
    </svg>`;
    return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to coverage updated events
    this.mcpClient.onCoverageUpdated((coverage) => {
      this.updateCoverage(coverage);
    });

    // Listen to active editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && this.coverageEnabled) {
        this.updateDecorationsForEditor(editor);
      }
    });

    // Listen to text document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document && this.coverageEnabled) {
        // Debounce updates
        setTimeout(() => {
          this.updateDecorationsForEditor(editor);
        }, 500);
      }
    });
  }

  /**
   * Update coverage data
   */
  updateCoverage(coverage: CoverageReport): void {
    try {
      // Clear existing coverage data
      this.coverageData.clear();

      // Store coverage data for each file
      for (const [filePath, fileCoverage] of Object.entries(coverage.files)) {
        this.coverageData.set(filePath, fileCoverage as FileCoverage);
      }

      // Update status bar
      this.updateStatusBar(coverage);

      // Update decorations for all visible editors
      if (this.coverageEnabled) {
        for (const editor of vscode.window.visibleTextEditors) {
          this.updateDecorationsForEditor(editor);
        }
      }

      this.outputChannel.debug(`Updated coverage data for ${this.coverageData.size} files`);
    } catch (error) {
      this.outputChannel.error(
        `Failed to update coverage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update status bar with coverage information
   */
  private updateStatusBar(coverage: CoverageReport): void {
    const linePercentage = coverage.overall.lines.percentage.toFixed(1);
    const branchPercentage = coverage.overall.branches.percentage.toFixed(1);
    const functionPercentage = coverage.overall.functions.percentage.toFixed(1);

    // Get thresholds from configuration
    const config = vscode.workspace.getConfiguration('mcp-testing');
    const thresholds: CoverageThresholds = {
      lines: config.get('coverage.thresholds.lines', 80),
      branches: config.get('coverage.thresholds.branches', 75),
      functions: config.get('coverage.thresholds.functions', 85),
      statements: config.get('coverage.thresholds.statements', 80),
    };

    // Check if any threshold is violated
    const thresholdViolated =
      (thresholds.lines && coverage.overall.lines.percentage < thresholds.lines) ||
      (thresholds.branches && coverage.overall.branches.percentage < thresholds.branches) ||
      (thresholds.functions && coverage.overall.functions.percentage < thresholds.functions) ||
      (thresholds.statements && coverage.overall.statements.percentage < thresholds.statements);

    // Update status bar text and color
    this.statusBarItem.text = `$(symbol-misc) Coverage: ${linePercentage}% | ${branchPercentage}% | ${functionPercentage}%`;

    if (thresholdViolated) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.tooltip = `Coverage thresholds violated!\nLines: ${linePercentage}% (threshold: ${thresholds.lines}%)\nBranches: ${branchPercentage}% (threshold: ${thresholds.branches}%)\nFunctions: ${functionPercentage}% (threshold: ${thresholds.functions}%)`;
    } else {
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = `Coverage:\nLines: ${linePercentage}%\nBranches: ${branchPercentage}%\nFunctions: ${functionPercentage}%\n\nClick to toggle coverage display`;
    }

    this.statusBarItem.show();
  }

  /**
   * Update decorations for a specific editor
   */
  private updateDecorationsForEditor(editor: vscode.TextEditor): void {
    try {
      const filePath = editor.document.uri.fsPath;
      const fileCoverage = this.coverageData.get(filePath);

      if (!fileCoverage) {
        // No coverage data for this file, clear decorations
        this.clearDecorationsForEditor(editor);
        return;
      }

      const coveredRanges: vscode.DecorationOptions[] = [];
      const uncoveredRanges: vscode.DecorationOptions[] = [];
      const partiallyCoveredRanges: vscode.DecorationOptions[] = [];

      // Process line coverage
      for (const [lineNumber, lineCoverage] of Object.entries(fileCoverage.lines)) {
        const line = parseInt(lineNumber) - 1; // Convert to 0-based

        if (line < 0 || line >= editor.document.lineCount) {
          continue;
        }

        const range = new vscode.Range(line, 0, line, editor.document.lineAt(line).text.length);

        // Check if line has branches
        const lineBranches = fileCoverage.branches.filter((b) => b.line === parseInt(lineNumber));
        const hasPartialBranches = lineBranches.length > 0 && lineBranches.some((b) => !b.taken);

        if (lineCoverage.covered && !hasPartialBranches) {
          // Fully covered
          const hoverMessage = this.createCoveredHoverMessage(lineCoverage, fileCoverage);
          coveredRanges.push({
            range,
            hoverMessage,
          });
        } else if (!lineCoverage.covered) {
          // Uncovered
          const hoverMessage = this.createUncoveredHoverMessage(lineCoverage);
          uncoveredRanges.push({
            range,
            hoverMessage,
          });
        } else if (hasPartialBranches) {
          // Partially covered (some branches not taken)
          const hoverMessage = this.createPartiallyCoveredHoverMessage(lineCoverage, lineBranches);
          partiallyCoveredRanges.push({
            range,
            hoverMessage,
          });
        }
      }

      // Apply decorations
      editor.setDecorations(this.coveredDecorationType, coveredRanges);
      editor.setDecorations(this.uncoveredDecorationType, uncoveredRanges);
      editor.setDecorations(this.partiallyCoveredDecorationType, partiallyCoveredRanges);

      this.outputChannel.debug(
        `Updated decorations for ${filePath}: ${coveredRanges.length} covered, ${uncoveredRanges.length} uncovered, ${partiallyCoveredRanges.length} partially covered`
      );
    } catch (error) {
      this.outputChannel.error(
        `Failed to update decorations: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create hover message for covered line
   */
  private createCoveredHoverMessage(
    lineCoverage: LineCoverage,
    fileCoverage: FileCoverage
  ): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    markdown.appendMarkdown(`### ✅ Covered Line\n\n`);
    markdown.appendMarkdown(`**Hits:** ${lineCoverage.hits}\n\n`);

    // Find tests that cover this line
    markdown.appendMarkdown(`**Covered by tests:**\n`);
    markdown.appendMarkdown(`- Test execution ${fileCoverage.path}\n`);

    return markdown;
  }

  /**
   * Create hover message for uncovered line
   */
  private createUncoveredHoverMessage(lineCoverage: LineCoverage): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    markdown.appendMarkdown(`### ❌ Uncovered Line\n\n`);
    markdown.appendMarkdown(`This line is not covered by any tests.\n\n`);
    markdown.appendMarkdown(
      `[Generate Tests](command:mcp-testing.generateTests) to improve coverage.\n`
    );

    return markdown;
  }

  /**
   * Create hover message for partially covered line
   */
  private createPartiallyCoveredHoverMessage(
    lineCoverage: LineCoverage,
    branches: BranchCoverage[]
  ): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    markdown.appendMarkdown(`### ⚠️ Partially Covered Line\n\n`);
    markdown.appendMarkdown(`**Hits:** ${lineCoverage.hits}\n\n`);

    const takenBranches = branches.filter((b) => b.taken).length;
    const totalBranches = branches.length;

    markdown.appendMarkdown(
      `**Branch Coverage:** ${takenBranches}/${totalBranches} branches taken\n\n`
    );
    markdown.appendMarkdown(`Some branches are not covered by tests.\n\n`);
    markdown.appendMarkdown(
      `[Generate Tests](command:mcp-testing.generateTests) to improve branch coverage.\n`
    );

    return markdown;
  }

  /**
   * Clear decorations for a specific editor
   */
  private clearDecorationsForEditor(editor: vscode.TextEditor): void {
    editor.setDecorations(this.coveredDecorationType, []);
    editor.setDecorations(this.uncoveredDecorationType, []);
    editor.setDecorations(this.partiallyCoveredDecorationType, []);
  }

  /**
   * Toggle coverage display
   */
  toggleCoverage(): void {
    this.coverageEnabled = !this.coverageEnabled;

    if (this.coverageEnabled) {
      // Show coverage for all visible editors
      for (const editor of vscode.window.visibleTextEditors) {
        this.updateDecorationsForEditor(editor);
      }
      vscode.window.showInformationMessage('Coverage display enabled');
    } else {
      // Clear coverage for all visible editors
      for (const editor of vscode.window.visibleTextEditors) {
        this.clearDecorationsForEditor(editor);
      }
      vscode.window.showInformationMessage('Coverage display disabled');
    }

    this.outputChannel.debug(`Coverage display ${this.coverageEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle heat map mode
   */
  toggleHeatMapMode(): void {
    this.heatMapMode = !this.heatMapMode;

    if (this.coverageEnabled) {
      // Refresh decorations with new mode
      for (const editor of vscode.window.visibleTextEditors) {
        this.updateDecorationsForEditor(editor);
      }
    }

    vscode.window.showInformationMessage(
      `Heat map mode ${this.heatMapMode ? 'enabled' : 'disabled'}`
    );
    this.outputChannel.debug(`Heat map mode ${this.heatMapMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clear coverage data
   */
  clearCoverage(): void {
    this.coverageData.clear();

    // Clear decorations for all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      this.clearDecorationsForEditor(editor);
    }

    // Hide status bar
    this.statusBarItem.hide();

    this.outputChannel.debug('Cleared coverage data');
  }

  /**
   * Get coverage for a specific file
   */
  getCoverageForFile(filePath: string): FileCoverage | undefined {
    return this.coverageData.get(filePath);
  }

  /**
   * Check if coverage is enabled
   */
  isCoverageEnabled(): boolean {
    return this.coverageEnabled;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.coveredDecorationType.dispose();
    this.uncoveredDecorationType.dispose();
    this.partiallyCoveredDecorationType.dispose();
    this.statusBarItem.dispose();
    this.coverageData.clear();
  }
}
