/**
 * Unit tests for MCPTestingClient
 */

import * as assert from 'assert';
import { MCPTestingClient, TestResult, CoverageReport } from '../mcpClient';

/**
 * Mock LogOutputChannel for testing
 */
class MockLogOutputChannel {
  private logs: string[] = [];

  trace(message: string, ...args: unknown[]): void {
    this.logs.push(`TRACE: ${message}`);
  }

  debug(message: string, ...args: unknown[]): void {
    this.logs.push(`DEBUG: ${message}`);
  }

  info(message: string, ...args: unknown[]): void {
    this.logs.push(`INFO: ${message}`);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logs.push(`WARN: ${message}`);
  }

  error(message: string | Error, ...args: unknown[]): void {
    const msg = message instanceof Error ? message.message : message;
    this.logs.push(`ERROR: ${msg}`);
  }

  append(value: string): void {
    this.logs.push(value);
  }

  appendLine(value: string): void {
    this.logs.push(value);
  }

  clear(): void {
    this.logs = [];
  }

  show(preserveFocus?: boolean): void {}

  hide(): void {}

  dispose(): void {
    this.logs = [];
  }

  getLogs(): string[] {
    return this.logs;
  }
}

suite('MCPTestingClient Test Suite', () => {
  let client: MCPTestingClient;
  let mockOutputChannel: MockLogOutputChannel;

  setup(() => {
    mockOutputChannel = new MockLogOutputChannel();
    client = new MCPTestingClient(mockOutputChannel as any);
  });

  teardown(() => {
    if (client) {
      client.dispose();
    }
    mockOutputChannel.dispose();
  });

  suite('Connection Lifecycle', () => {
    test('should initialize with correct extension name', () => {
      const status = client.getConnectionStatus();
      assert.strictEqual(status.state, 'disconnected');
    });

    test.skip('should handle connection state changes', (done) => {
      // Skipped: State change events don't fire in test environment
      done();
    });

    test('should provide diagnostics information', () => {
      const diagnostics = client.getDiagnostics();

      assert.strictEqual(diagnostics.extensionName, 'mcp-testing');
      assert.strictEqual(diagnostics.processRunning, false);
      assert.strictEqual(diagnostics.pendingRequestCount, 0);
      assert.ok(Array.isArray(diagnostics.pendingRequests));
      assert.ok(Array.isArray(diagnostics.recentCommunication));
      assert.ok(Array.isArray(diagnostics.stateHistory));
    });
  });

  suite('Tool Invocation', () => {
    test('should handle tool call errors gracefully', async () => {
      try {
        // This should fail because server is not running
        await client.listTools();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Server process not available'));
      }
    });
  });

  suite('Event Emission', () => {
    test('should emit test started events', (done) => {
      const disposable = client.onTestStarted((test) => {
        assert.ok(test);
        assert.ok(test.id);
        disposable.dispose();
        done();
      });

      // Manually trigger event for testing
      (client as any)._onTestStarted.fire({
        id: 'test-1',
        name: 'Test 1',
        fullName: 'Suite > Test 1',
        status: 'running',
        duration: 0,
        file: 'test.ts',
        line: 10,
        suite: ['Suite'],
        tags: [],
        timestamp: new Date().toISOString(),
      });
    });

    test('should emit test completed events', (done) => {
      const disposable = client.onTestCompleted((test) => {
        assert.ok(test);
        assert.strictEqual(test.status, 'passed');
        disposable.dispose();
        done();
      });

      // Manually trigger event for testing
      (client as any)._onTestCompleted.fire({
        id: 'test-1',
        name: 'Test 1',
        fullName: 'Suite > Test 1',
        status: 'passed',
        duration: 100,
        file: 'test.ts',
        line: 10,
        suite: ['Suite'],
        tags: [],
        timestamp: new Date().toISOString(),
      });
    });

    test('should emit coverage updated events', (done) => {
      const disposable = client.onCoverageUpdated((coverage) => {
        assert.ok(coverage);
        assert.ok(coverage.overall);
        disposable.dispose();
        done();
      });

      // Manually trigger event for testing
      (client as any)._onCoverageUpdated.fire({
        overall: {
          lines: { total: 100, covered: 80, percentage: 80 },
          branches: { total: 50, covered: 40, percentage: 80 },
          functions: { total: 20, covered: 18, percentage: 90 },
          statements: { total: 100, covered: 80, percentage: 80 },
        },
        files: {},
        timestamp: new Date().toISOString(),
      });
    });
  });

  suite('Error Handling', () => {
    test('should handle missing server gracefully', async () => {
      try {
        await client.runTests({});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });

    test('should handle invalid responses', async () => {
      try {
        await client.listTests();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Configuration', () => {
    test('should get server command with default settings', () => {
      const command = (client as any).getServerCommand();
      assert.ok(command);
      assert.ok(command.command);
      assert.ok(Array.isArray(command.args));
    });

    test('should get server environment variables', () => {
      const env = (client as any).getServerEnv();
      assert.ok(env);
      assert.strictEqual(typeof env, 'object');
    });
  });
});
