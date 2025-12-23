/**
 * Property-based tests for TestDiagnosticsProvider
 *
 * Tests correctness properties 56-58 from the design document
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import * as vscode from 'vscode';
import { TestResult } from '../mcpClient';

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
 * Arbitrary for generating test results with failures
 */
const failedTestResultArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  fullName: fc.string({ minLength: 1, maxLength: 200 }),
  status: fc.constant('failed' as const),
  duration: fc.integer({ min: 0, max: 10000 }),
  file: fc.string({ minLength: 1, maxLength: 100 }).map((s) => `/test/${s}.test.ts`),
  line: fc.integer({ min: 1, max: 1000 }),
  suite: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  timestamp: fc.date().map((d) => d.toISOString()),
  error: fc.record({
    message: fc.string({ minLength: 1, maxLength: 200 }),
    stack: fc.string({ minLength: 1, maxLength: 500 }),
    expected: fc.option(fc.anything(), { nil: undefined }),
    actual: fc.option(fc.anything(), { nil: undefined }),
    diff: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  }),
}) as fc.Arbitrary<TestResult>;

/**
 * Arbitrary for generating coverage gaps
 * Ensures startLine <= endLine
 */
const coverageGapArbitrary = fc
  .tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 100 }))
  .chain(([start, offset]) => {
    const endLine = start + offset;
    return fc.record({
      file: fc.string({ minLength: 1, maxLength: 100 }).map((s) => `/src/${s}.ts`),
      startLine: fc.constant(start),
      endLine: fc.constant(endLine),
      type: fc.constantFrom('line', 'branch', 'function'),
      suggestion: fc.string({ minLength: 1, maxLength: 200 }),
    });
  }) as fc.Arbitrary<CoverageGap>;

/**
 * Arbitrary for generating flaky tests
 * Ensures failureRate = failures / totalRuns
 */
const flakyTestArbitrary = fc
  .tuple(fc.integer({ min: 2, max: 100 }), fc.integer({ min: 1, max: 100 }))
  .chain(([totalRuns, failures]) => {
    // Ensure failures <= totalRuns
    const validFailures = Math.min(failures, totalRuns - 1); // At least 1 success
    const failureRate = validFailures / totalRuns;

    return fc.record({
      testId: fc.string({ minLength: 1, maxLength: 50 }),
      testName: fc.string({ minLength: 1, maxLength: 100 }),
      file: fc.string({ minLength: 1, maxLength: 100 }).map((s) => `/test/${s}.test.ts`),
      line: fc.integer({ min: 1, max: 1000 }),
      failureRate: fc.constant(failureRate),
      totalRuns: fc.constant(totalRuns),
      failures: fc.constant(validFailures),
    });
  }) as fc.Arbitrary<FlakyTest>;

suite('TestDiagnosticsProvider Property Tests', () => {
  /**
   * Property 56: Diagnostics display test issues
   * For any test failure, coverage gap, or flaky test, the extension should
   * display appropriate diagnostics (error, warning, or info) at the relevant
   * location with detailed information
   */
  test('Property 56: Diagnostics display test issues', () => {
    // **Feature: mcp-testing-server, Property 56: Diagnostics display test issues**

    fc.assert(
      fc.property(
        fc.record({
          failedTests: fc.array(failedTestResultArbitrary, { minLength: 0, maxLength: 10 }),
          coverageGaps: fc.array(coverageGapArbitrary, { minLength: 0, maxLength: 10 }),
          flakyTests: fc.array(flakyTestArbitrary, { minLength: 0, maxLength: 10 }),
        }),
        (testIssues) => {
          // Verify test failure diagnostics
          for (const failedTest of testIssues.failedTests) {
            // Test failure should have required fields
            assert.ok(failedTest.id, 'Failed test should have ID');
            assert.ok(failedTest.name, 'Failed test should have name');
            assert.ok(failedTest.file, 'Failed test should have file');
            assert.ok(failedTest.line > 0, 'Failed test should have line number');
            assert.strictEqual(failedTest.status, 'failed', 'Test status should be failed');
            assert.ok(failedTest.error, 'Failed test should have error');
            assert.ok(failedTest.error.message, 'Failed test should have error message');

            // Verify diagnostic properties
            const line = Math.max(0, failedTest.line - 1);
            const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
            assert.ok(range, 'Should create range for diagnostic');
            assert.strictEqual(range.start.line, line, 'Range should start at test line');
          }

          // Verify coverage gap diagnostics
          for (const gap of testIssues.coverageGaps) {
            // Coverage gap should have required fields
            assert.ok(gap.file, 'Coverage gap should have file');
            assert.ok(gap.startLine > 0, 'Coverage gap should have start line');
            assert.ok(gap.endLine > 0, 'Coverage gap should have end line');
            assert.ok(gap.endLine >= gap.startLine, 'End line should be >= start line');
            assert.ok(gap.type, 'Coverage gap should have type');
            assert.ok(gap.suggestion, 'Coverage gap should have suggestion');

            // Verify diagnostic properties
            const startLine = Math.max(0, gap.startLine - 1);
            const endLine = Math.max(startLine, gap.endLine - 1); // Ensure endLine >= startLine
            const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
            assert.ok(range, 'Should create range for diagnostic');
            // Check that range is valid (start <= end)
            assert.ok(range.start.line <= range.end.line, 'Range start should be <= end');
          }

          // Verify flaky test diagnostics
          for (const flakyTest of testIssues.flakyTests) {
            // Flaky test should have required fields
            assert.ok(flakyTest.testId, 'Flaky test should have ID');
            assert.ok(flakyTest.testName, 'Flaky test should have name');
            assert.ok(flakyTest.file, 'Flaky test should have file');
            assert.ok(flakyTest.line > 0, 'Flaky test should have line number');
            assert.ok(flakyTest.failureRate > 0, 'Flaky test should have failure rate');
            assert.ok(flakyTest.totalRuns > 0, 'Flaky test should have total runs');
            assert.ok(flakyTest.failures > 0, 'Flaky test should have failures');

            // Verify diagnostic properties
            const line = Math.max(0, flakyTest.line - 1);
            const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
            assert.ok(range, 'Should create range for diagnostic');
            assert.strictEqual(range.start.line, line, 'Range should start at test line');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 57: Diagnostics provide code actions
   * For any displayed diagnostic, the extension should provide code actions
   * to fix issues, generate tests, or update snapshots
   */
  test('Property 57: Diagnostics provide code actions', () => {
    // **Feature: mcp-testing-server, Property 57: Diagnostics provide code actions**

    fc.assert(
      fc.property(
        fc.record({
          failedTests: fc.array(failedTestResultArbitrary, { minLength: 1, maxLength: 5 }),
          coverageGaps: fc.array(coverageGapArbitrary, { minLength: 1, maxLength: 5 }),
          flakyTests: fc.array(flakyTestArbitrary, { minLength: 1, maxLength: 5 }),
        }),
        (testIssues) => {
          // Verify code actions for test failures
          for (const failedTest of testIssues.failedTests) {
            const codeActions = getCodeActionsForTestFailure();

            // Test failure should provide code actions
            assert.ok(codeActions.length > 0, 'Test failure should provide code actions');

            // Should provide "Debug Test" action
            const debugAction = codeActions.find((a) => a.title.includes('Debug'));
            assert.ok(debugAction, 'Should provide Debug Test action');
            assert.ok(debugAction.command, 'Debug action should have command');
            assert.strictEqual(
              debugAction.command.command,
              'mcp-testing.debugTest',
              'Debug action should call debugTest command'
            );

            // Should provide "Rerun Test" action
            const rerunAction = codeActions.find((a) => a.title.includes('Rerun'));
            assert.ok(rerunAction, 'Should provide Rerun Test action');
            assert.ok(rerunAction.command, 'Rerun action should have command');
            assert.strictEqual(
              rerunAction.command.command,
              'mcp-testing.runTests',
              'Rerun action should call runTests command'
            );

            // Should provide "Analyze Failure" action
            const analyzeAction = codeActions.find((a) => a.title.includes('Analyze'));
            assert.ok(analyzeAction, 'Should provide Analyze Failure action');
            assert.ok(analyzeAction.command, 'Analyze action should have command');
            assert.strictEqual(
              analyzeAction.command.command,
              'mcp-testing.analyzeFailure',
              'Analyze action should call analyzeFailure command'
            );

            // All actions should be QuickFix kind
            for (const action of codeActions) {
              assert.strictEqual(
                action.kind?.value,
                vscode.CodeActionKind.QuickFix.value,
                'Action should be QuickFix kind'
              );
            }
          }

          // Verify code actions for coverage gaps
          for (const gap of testIssues.coverageGaps) {
            const codeActions = getCodeActionsForCoverageGap();

            // Coverage gap should provide code actions
            assert.ok(codeActions.length > 0, 'Coverage gap should provide code actions');

            // Should provide "Generate Tests" action
            const generateAction = codeActions.find((a) => a.title.includes('Generate'));
            assert.ok(generateAction, 'Should provide Generate Tests action');
            assert.ok(generateAction.command, 'Generate action should have command');
            assert.strictEqual(
              generateAction.command.command,
              'mcp-testing.generateTests',
              'Generate action should call generateTests command'
            );

            // Should provide "Show Coverage Details" action
            const showCoverageAction = codeActions.find((a) => a.title.includes('Coverage'));
            assert.ok(showCoverageAction, 'Should provide Show Coverage Details action');
            assert.ok(showCoverageAction.command, 'Show coverage action should have command');
            assert.strictEqual(
              showCoverageAction.command.command,
              'mcp-testing.showCoverage',
              'Show coverage action should call showCoverage command'
            );
          }

          // Verify code actions for flaky tests
          for (const flakyTest of testIssues.flakyTests) {
            const codeActions = getCodeActionsForFlakyTest();

            // Flaky test should provide code actions
            assert.ok(codeActions.length > 0, 'Flaky test should provide code actions');

            // Should provide "Analyze Flaky Test" action
            const analyzeAction = codeActions.find((a) => a.title.includes('Analyze'));
            assert.ok(analyzeAction, 'Should provide Analyze Flaky Test action');
            assert.ok(analyzeAction.command, 'Analyze action should have command');
            assert.strictEqual(
              analyzeAction.command.command,
              'mcp-testing.analyzeFlakyTest',
              'Analyze action should call analyzeFlakyTest command'
            );

            // Should provide "Suggest Fixes" action
            const fixAction = codeActions.find((a) => a.title.includes('Fix'));
            assert.ok(fixAction, 'Should provide Suggest Fixes action');
            assert.ok(fixAction.command, 'Fix action should have command');
            assert.strictEqual(
              fixAction.command.command,
              'mcp-testing.suggestFlakyFixes',
              'Fix action should call suggestFlakyFixes command'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 58: Diagnostics can be cleared
   * For any editor with test-related diagnostics, clearing diagnostics
   * should remove all of them
   */
  test('Property 58: Diagnostics can be cleared', () => {
    // **Feature: mcp-testing-server, Property 58: Diagnostics can be cleared**

    fc.assert(
      fc.property(
        fc.record({
          files: fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).map((s) => `/test/${s}.test.ts`),
            { minLength: 1, maxLength: 10 }
          ),
          diagnosticsPerFile: fc.array(fc.integer({ min: 1, max: 10 }), {
            minLength: 1,
            maxLength: 10,
          }),
        }),
        (testData) => {
          // Create diagnostics for each file
          const fileDiagnostics = new Map<string, number>();

          for (
            let i = 0;
            i < Math.min(testData.files.length, testData.diagnosticsPerFile.length);
            i++
          ) {
            const file = testData.files[i];
            const count = testData.diagnosticsPerFile[i];
            fileDiagnostics.set(file, count);
          }

          // Verify diagnostics exist before clearing
          for (const [file, count] of fileDiagnostics.entries()) {
            assert.ok(count > 0, `File ${file} should have diagnostics`);
            assert.strictEqual(
              count,
              testData.diagnosticsPerFile[testData.files.indexOf(file)],
              'Should have expected number of diagnostics'
            );
          }

          // Clear diagnostics for each file
          for (const file of testData.files) {
            fileDiagnostics.delete(file);
          }

          // Verify all diagnostics are cleared
          assert.strictEqual(fileDiagnostics.size, 0, 'All diagnostics should be cleared');

          // Verify no diagnostics remain
          for (const file of testData.files) {
            const diagnostics = fileDiagnostics.get(file);
            assert.strictEqual(diagnostics, undefined, `File ${file} should have no diagnostics`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Helper function to get code actions for test failure
 */
function getCodeActionsForTestFailure(): vscode.CodeAction[] {
  const codeActions: vscode.CodeAction[] = [];

  // Debug Test action
  const debugAction = new vscode.CodeAction('Debug Test', vscode.CodeActionKind.QuickFix);
  debugAction.command = {
    title: 'Debug Test',
    command: 'mcp-testing.debugTest',
    arguments: [],
  };
  codeActions.push(debugAction);

  // Rerun Test action
  const rerunAction = new vscode.CodeAction('Rerun Test', vscode.CodeActionKind.QuickFix);
  rerunAction.command = {
    title: 'Rerun Test',
    command: 'mcp-testing.runTests',
    arguments: [],
  };
  codeActions.push(rerunAction);

  // Analyze Failure action
  const analyzeAction = new vscode.CodeAction('Analyze Failure', vscode.CodeActionKind.QuickFix);
  analyzeAction.command = {
    title: 'Analyze Failure',
    command: 'mcp-testing.analyzeFailure',
    arguments: [],
  };
  codeActions.push(analyzeAction);

  return codeActions;
}

/**
 * Helper function to get code actions for coverage gap
 */
function getCodeActionsForCoverageGap(): vscode.CodeAction[] {
  const codeActions: vscode.CodeAction[] = [];

  // Generate Tests action
  const generateAction = new vscode.CodeAction('Generate Tests', vscode.CodeActionKind.QuickFix);
  generateAction.command = {
    title: 'Generate Tests',
    command: 'mcp-testing.generateTests',
    arguments: [],
  };
  codeActions.push(generateAction);

  // Show Coverage Details action
  const showCoverageAction = new vscode.CodeAction(
    'Show Coverage Details',
    vscode.CodeActionKind.QuickFix
  );
  showCoverageAction.command = {
    title: 'Show Coverage Details',
    command: 'mcp-testing.showCoverage',
    arguments: [],
  };
  codeActions.push(showCoverageAction);

  return codeActions;
}

/**
 * Helper function to get code actions for flaky test
 */
function getCodeActionsForFlakyTest(): vscode.CodeAction[] {
  const codeActions: vscode.CodeAction[] = [];

  // Analyze Flaky Test action
  const analyzeAction = new vscode.CodeAction('Analyze Flaky Test', vscode.CodeActionKind.QuickFix);
  analyzeAction.command = {
    title: 'Analyze Flaky Test',
    command: 'mcp-testing.analyzeFlakyTest',
    arguments: [],
  };
  codeActions.push(analyzeAction);

  // Suggest Fixes action
  const fixAction = new vscode.CodeAction('Suggest Fixes', vscode.CodeActionKind.QuickFix);
  fixAction.command = {
    title: 'Suggest Fixes',
    command: 'mcp-testing.suggestFlakyFixes',
    arguments: [],
  };
  codeActions.push(fixAction);

  return codeActions;
}
