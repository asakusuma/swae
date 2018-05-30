import { createSession, ISession } from 'chrome-debugging-client';
import { TestEnvironment } from './app-env';
import { TestServerApi } from './test-server-api';

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

  private async spawnBrowser(session: ISession) {

    try {
      return await session.spawnBrowser({
        additionalArguments: ['--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio'],
        windowSize: { width: 640, height: 320 }
      });
    } catch (err) {
      console.error(`Error encountered when spawning chrome: ${err.message}`);
      throw err;
    }
  }

  private async runDebuggingSession(test: (appEnv: TestEnvironment<S>) => Promise<void>, server: S) {
    return createSession(async (session) => {
      const browser = await this.spawnBrowser(session);
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