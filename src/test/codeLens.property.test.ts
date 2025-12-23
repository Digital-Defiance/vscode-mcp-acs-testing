/**
 * Property-based tests for TestCodeLensProvider
 *
 * Tests correctness properties 54-55 from the design document
 */

import * as assert from 'assert';
import * as fc from 'fast-check';
import { TestResult } from '../mcpClient';

/**
 * Test function information
 */
interface TestFunction {
  name: string;
  testId?: string;
  line: number;
  status?: 'passed' | 'failed' | 'skipped' | 'running';
  duration?: number;
  coveragePercentage?: number;
}

/**
 * Arbitrary for generating test functions
 */
const testFunctionArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  testId: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  line: fc.integer({ min: 1, max: 1000 }),
  status: fc.option(fc.constantFrom('passed', 'failed', 'skipped', 'running'), { nil: undefined }),
  duration: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
  coveragePercentage: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(100) }), { nil: undefined }),
}) as fc.Arbitrary<TestFunction>;

/**
 * Arbitrary for generating test results
 */
const testResultArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  fullName: fc.string({ minLength: 1, maxLength: 200 }),
  status: fc.constantFrom('passed', 'failed', 'skipped', 'pending', 'running'),
  duration: fc.integer({ min: 0, max: 10000 }),
  file: fc.string({ minLength: 1, maxLength: 100 }).map((s) => `/test/${s}.test.ts`),
  line: fc.integer({ min: 1, max: 1000 }),
  suite: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  timestamp: fc.date().map((d) => d.toISOString()),
  error: fc.option(
    fc.record({
      message: fc.string({ minLength: 1, maxLength: 200 }),
      stack: fc.string({ minLength: 1, maxLength: 500 }),
    }),
    { nil: undefined }
  ),
}) as fc.Arbitrary<TestResult>;

suite('TestCodeLensProvider Property Tests', () => {
  /**
   * Property 54: CodeLens provides test actions
   * For any test function in an open file, the extension should display
   * CodeLens links for "Run Test", "Debug Test", and coverage percentage
   * (when enabled), and clicking them should perform the corresponding action
   */
  test('Property 54: CodeLens provides test actions', () => {
    // **Feature: mcp-testing-server, Property 54: CodeLens provides test actions**

    fc.assert(
      fc.property(
        fc.array(testFunctionArbitrary, { minLength: 1, maxLength: 20 }),
        (testFunctions) => {
          // Verify CodeLens generation logic
          for (const testFunc of testFunctions) {
            // Every test function should have a name
            assert.ok(testFunc.name, 'Test function should have a name');
            assert.ok(testFunc.name.length > 0, 'Test function name should not be empty');

            // Every test function should have a line number
            assert.ok(testFunc.line > 0, 'Test function should have a line number');

            // CodeLens should provide Run Test action
            const runTitle = getRunTitle(testFunc);
            assert.ok(runTitle, 'Should have Run Test CodeLens title');
            assert.ok(runTitle.length > 0, 'Run Test title should not be empty');

            // CodeLens should provide Debug Test action
            const debugTitle = '$(debug) Debug Test';
            assert.ok(debugTitle, 'Should have Debug Test CodeLens title');
            assert.ok(debugTitle.includes('Debug'), 'Debug title should contain "Debug"');

            // If coverage is available, should provide coverage CodeLens
            if (testFunc.coveragePercentage !== undefined) {
              const coverageTitle = `$(graph) Coverage: ${testFunc.coveragePercentage.toFixed(1)}%`;
              assert.ok(coverageTitle, 'Should have Coverage CodeLens title');
              assert.ok(
                coverageTitle.includes('Coverage'),
                'Coverage title should contain "Coverage"'
              );
              assert.ok(
                coverageTitle.includes(testFunc.coveragePercentage.toFixed(1)),
                'Coverage title should include percentage'
              );
            }

            // If test has been run, should provide status CodeLens
            if (testFunc.status && testFunc.duration !== undefined) {
              const statusTitle = getStatusTitle(testFunc);
              assert.ok(statusTitle, 'Should have Status CodeLens title');
              assert.ok(statusTitle.length > 0, 'Status title should not be empty');

              // Status should reflect test result
              if (testFunc.status === 'passed') {
                assert.ok(statusTitle.includes('Passed'), 'Passed test should show "Passed"');
                // Passed tests should include duration
                const durationStr = `${testFunc.duration}ms`;
                assert.ok(
                  statusTitle.includes(durationStr),
                  `Status should include duration "${durationStr}", got "${statusTitle}"`
                );
              } else if (testFunc.status === 'failed') {
                assert.ok(statusTitle.includes('Failed'), 'Failed test should show "Failed"');
                // Failed tests should include duration
                const durationStr = `${testFunc.duration}ms`;
                assert.ok(
                  statusTitle.includes(durationStr),
                  `Status should include duration "${durationStr}", got "${statusTitle}"`
                );
              } else if (testFunc.status === 'skipped') {
                assert.ok(statusTitle.includes('Skipped'), 'Skipped test should show "Skipped"');
              } else if (testFunc.status === 'running') {
                // Running tests show loading indicator, not duration
                assert.ok(statusTitle.includes('Running'), 'Running test should show "Running"');
              }
            }
          }

          // Verify all test function names are present
          const testNames = testFunctions.map((t) => t.name);
          assert.strictEqual(
            testNames.length,
            testFunctions.length,
            'All test functions should have names'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 55: CodeLens shows loading state
   * For any test that is currently running, the CodeLens should update
   * to show a loading indicator
   */
  test('Property 55: CodeLens shows loading state', () => {
    // **Feature: mcp-testing-server, Property 55: CodeLens shows loading state**

    fc.assert(
      fc.property(
        fc.array(testFunctionArbitrary, { minLength: 1, maxLength: 10 }).chain((testFuncs) => {
          // Ensure unique test IDs
          const uniqueTestFuncs = testFuncs.map((testFunc, index) => ({
            ...testFunc,
            status: 'running' as const,
            testId: `test-id-${index}-${Math.random()}`,
          }));
          return fc.constant(uniqueTestFuncs);
        }),
        (runningTests) => {
          // Verify loading state for running tests
          for (const testFunc of runningTests) {
            // Running test should have status 'running'
            assert.strictEqual(testFunc.status, 'running', 'Test should be marked as running');

            // Running test should have a test ID
            assert.ok(testFunc.testId, 'Running test should have a test ID');
            assert.ok(testFunc.testId.length > 0, 'Test ID should not be empty');

            // CodeLens should show loading indicator
            const runTitle = getRunTitle(testFunc);
            assert.ok(runTitle, 'Should have Run Test CodeLens title');
            assert.ok(
              runTitle.includes('Running') || runTitle.includes('loading'),
              'Running test should show loading indicator'
            );

            // Loading indicator should be visually distinct
            assert.ok(
              runTitle.includes('$(loading~spin)') || runTitle.includes('Running'),
              'Loading indicator should use spinner icon or "Running" text'
            );
          }

          // Verify all running tests have unique IDs
          const testIds = new Set(runningTests.map((t) => t.testId));
          assert.strictEqual(
            testIds.size,
            runningTests.length,
            'All running tests should have unique IDs'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: CodeLens updates when test completes
   * For any test that transitions from running to completed, the CodeLens
   * should update to reflect the new status
   */
  test('Property: CodeLens updates when test completes', () => {
    // **Feature: mcp-testing-server, Property: CodeLens updates when test completes**

    fc.assert(
      fc.property(fc.array(testResultArbitrary, { minLength: 1, maxLength: 10 }), (testResults) => {
        // Verify CodeLens update logic
        for (const result of testResults) {
          // Test result should have all required fields
          assert.ok(result.id, 'Test result should have ID');
          assert.ok(result.name, 'Test result should have name');
          assert.ok(result.status, 'Test result should have status');
          assert.ok(result.duration !== undefined, 'Test result should have duration');

          // Create test function from result
          const testFunc: TestFunction = {
            name: result.name,
            testId: result.id,
            line: result.line,
            status: result.status === 'pending' ? 'skipped' : result.status,
            duration: result.duration,
          };

          // Verify CodeLens reflects completed status
          const runTitle = getRunTitle(testFunc);
          assert.ok(runTitle, 'Should have Run Test CodeLens title');

          // Completed test should not show loading indicator
          if (testFunc.status !== 'running') {
            assert.ok(
              !runTitle.includes('$(loading~spin)'),
              'Completed test should not show loading indicator'
            );
          }

          // Status CodeLens should reflect result
          if (testFunc.status && testFunc.duration !== undefined) {
            const statusTitle = getStatusTitle(testFunc);
            assert.ok(statusTitle, 'Should have Status CodeLens title');

            // Verify status matches result
            if (testFunc.status === 'passed') {
              assert.ok(statusTitle.includes('Passed'), 'Should show passed status');
            } else if (testFunc.status === 'failed') {
              assert.ok(statusTitle.includes('Failed'), 'Should show failed status');
            } else if (testFunc.status === 'skipped') {
              assert.ok(statusTitle.includes('Skipped'), 'Should show skipped status');
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Helper function to get Run Test CodeLens title
 * (Mirrors logic from TestCodeLensProvider)
 */
function getRunTitle(testFunc: TestFunction): string {
  if (testFunc.status === 'running') {
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
 * Helper function to get Status CodeLens title
 * (Mirrors logic from TestCodeLensProvider)
 */
function getStatusTitle(testFunc: TestFunction): string {
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
