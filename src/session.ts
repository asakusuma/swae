import { createSession, ISession, IResolveOptions } from 'chrome-debugging-client';
import { TestEnvironment } from './app-env';
import { TestServerApi } from './test-server-api';

export interface SessionOptions {
  browserResolution?: IResolveOptions;
  additionalBrowserAargs?: string[];
}

/**
 * A test session, including a headless chrome instance
 * @public
 */
export class TestSession<S extends TestServerApi = TestServerApi> {
  public testServerPromise: Promise<S>;
  private browserResolution: IResolveOptions;
  private additionalBrowserAargs: string[];
  // private securityOrigin: string = 'http://localhost'; // TODO: make this dynamic
  constructor(testServerPromise: Promise<S>, options: SessionOptions = {}) {
    this.testServerPromise = testServerPromise;
    this.browserResolution = options.browserResolution || {};
    this.additionalBrowserAargs = options.additionalBrowserAargs || [];
  }
  public async ready(): Promise<void> {
    return this.testServerPromise
      .then(() => {}); // Ensure void return
  }
  public async close() {
    const server = await this.testServerPromise;
    return server.close();
  }

  private async spawnBrowser(session: ISession, additionalArgs: string[] = []) {
    try {
      const additionalArguments = ['--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio']
        .concat(additionalArgs);
        console.log(additionalArguments);
      return await session.spawnBrowser(Object.assign({
        additionalArguments,
        windowSize: { width: 640, height: 320 }
      }, this.browserResolution));
    } catch (err) {
      console.error(`Error encountered when spawning chrome: ${err.message}`);
      throw err;
    }
  }

  private async runDebuggingSession(test: (appEnv: TestEnvironment<S>) => Promise<void>, server: S, flags: string[]) {
    return createSession(async (session) => {
      const browser = await this.spawnBrowser(session, flags);
      const apiClient = session.createAPIClient('localhost', browser.remoteDebuggingPort);

      const appEnv = await TestEnvironment.build(apiClient, session, server);
      await test(appEnv);
      await appEnv.close();
    });
  }

  public async run(test: (appEnv: TestEnvironment<S>) => Promise<void>, additionalBrowserAargs: string[] = []) {
    const args = this.additionalBrowserAargs.concat(additionalBrowserAargs);
    const server = await this.testServerPromise;
    await this.runDebuggingSession(test, server, args);
    await server.reset();
  }
}