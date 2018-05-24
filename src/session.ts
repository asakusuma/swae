import { createSession } from 'chrome-debugging-client';
import { TestEnvironment } from './app-env';
import { TestServerApi } from './test-server-api';

// Import .env file for setting CHROME_BIN
import { config } from 'dotenv';
config();

/**
 * A test session, including a headless chrome instance
 * @public
 */
export class TestSession<S extends TestServerApi = TestServerApi> {
  public testServerPromise: Promise<S>;
  // private securityOrigin: string = 'http://localhost'; // TODO: make this dynamic
  constructor(testServerPromise: Promise<S>) {
    this.testServerPromise = testServerPromise;
  }
  public async ready(): Promise<void> {
    return this.testServerPromise
      .then(() => {}); // Ensure void return
  }
  public async close() {
    const server = await this.testServerPromise;
    return server.close();
  }

  private async runDebuggingSession(test: (appEnv: TestEnvironment<S>) => Promise<void>, server: S) {
    return createSession(async (session) => {
      const executablePath = process.env.CHROME_BIN;
      if (!executablePath) {
        throw new Error('The node CHROME_BIN environment variable must be set');
      }
      const browser = await session.spawnBrowser('exact', {
        executablePath,
        additionalArguments: ['--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio'],
        windowSize: { width: 640, height: 320 }
      });

      const apiClient = session.createAPIClient('localhost', browser.remoteDebuggingPort);

      const appEnv = await TestEnvironment.build(apiClient, session, server);
      await test(appEnv);
    });
  }

  public async run(test: (appEnv: TestEnvironment<S>) => Promise<void>) {
    const server = await this.testServerPromise;
    await this.runDebuggingSession(test, server);
    await server.reset();
  }
}