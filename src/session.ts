import { createSession, ISession, IResolveOptions } from 'chrome-debugging-client';
import { TestEnvironment } from './app-env';
import { TestServerApi } from './test-server-api';

export interface BrowserOptions extends IResolveOptions {
  userDataRoot?: string;
  headless?: boolean;
}

export interface SessionOptions {
  browserOptions?: BrowserOptions;
}

/**
 * A test session, including a headless chrome instance
 * @public
 */
export class TestSession<S extends TestServerApi = TestServerApi> {
  public testServerPromise: Promise<S>;
  private browserOptions: BrowserOptions;
  // private securityOrigin: string = 'http://localhost'; // TODO: make this dynamic
  constructor(testServerPromise: Promise<S>, options: SessionOptions = {}) {
    this.testServerPromise = testServerPromise;
    this.browserOptions = options.browserOptions || {};
  }
  public async ready(): Promise<void> {
    return this.testServerPromise
      .then(() => {}); // Ensure void return
  }
  public async close() {
    const server = await this.testServerPromise;
    return server.close();
  }

  private async spawnBrowser(session: ISession, options: BrowserOptions = {}) {
    const additionalArguments = ['--disable-gpu', '--hide-scrollbars', '--mute-audio'];
    if (options.headless !== false) {
      additionalArguments.push('--headless');
    }
    try {
      return await session.spawnBrowser(Object.assign({
        additionalArguments,
        windowSize: { width: 640, height: 320 }
      }, options, this.browserOptions));
    } catch (err) {
      console.error(`Error encountered when spawning chrome: ${err.message}`);
      throw err;
    }
  }

  private async runDebuggingSession(
    test: (appEnv: TestEnvironment<S>) => Promise<void>,
    server: S,
    options: BrowserOptions
  ) {
    return createSession(async (session) => {
      const browser = await this.spawnBrowser(session, options);
      const apiClient = session.createAPIClient('localhost', browser.remoteDebuggingPort);

      const appEnv = await TestEnvironment.build(apiClient, session, server);
      await test(appEnv);
      await appEnv.close();
    });
  }

  public async run(test: (appEnv: TestEnvironment<S>) => Promise<void>, options: BrowserOptions = {}) {
    const server = await this.testServerPromise;
    await this.runDebuggingSession(test, server, options);
    await server.reset();
  }
}