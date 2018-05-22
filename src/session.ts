import { createSession } from 'chrome-debugging-client';
import { ApplicationEnvironment } from "./app-env";
import { TestServerApi } from "./test-server-api";

export class TestSession<S extends TestServerApi = TestServerApi> {
  public testServerPromise: Promise<S>;
  // private securityOrigin: string = 'http://localhost'; // TODO: make this dynamic
  constructor(testServerPromise: Promise<S>) {
    this.testServerPromise = testServerPromise;
  }
  public async close() {
    const server = await this.testServerPromise;
    return server.close();
  }

  private async runDebuggingSession(test: (appEnv: ApplicationEnvironment<S>) => Promise<void>, server: S) {
    return createSession(async (session) => {
      const browser = await session.spawnBrowser('exact', {
        executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
        additionalArguments: ['--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio'],
        windowSize: { width: 640, height: 320 }
      });

      const apiClient = session.createAPIClient('localhost', browser.remoteDebuggingPort);

      const appEnv = await ApplicationEnvironment.build(apiClient, session, server);
      await test(appEnv);
    });
  }

  public async run(test: (appEnv: ApplicationEnvironment<S>) => Promise<void>) {
    const server = await this.testServerPromise;
    await this.runDebuggingSession(test, server);
    await server.reset();
  }
}