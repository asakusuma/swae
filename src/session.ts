import { spawnChrome, ChromeWithPipeConnection, SpawnOptions, RootConnection } from 'chrome-debugging-client';
import { TestEnvironment } from './app-env';
import { TestServerApi } from './test-server-api';
import { addTimeout } from './timeout';

export interface SessionOptions {
  browserOptions?: Partial<SpawnOptions>;
  debug?: boolean;
}

/**
 * A test session, including a headless chrome instance
 * @public
 */
export class TestSession<S extends TestServerApi = TestServerApi> {
  public testServerPromise: Promise<S>;

  private chrome?: ChromeWithPipeConnection;
  private sessionOptions: SessionOptions;
  private debug: boolean;

  // private securityOrigin: string = 'http://localhost'; // TODO: make this dynamic
  constructor(testServerPromise: Promise<S>, options: SessionOptions = {}) {
    this.testServerPromise = testServerPromise;
    this.sessionOptions = options;
    this.debug = options.debug || false;
  }
  private log(msg: string) {
    if (this.debug) {
      console.log('swae log', msg);
    }
  }
  public async ready(): Promise<void> {
    return this.testServerPromise
      .then(() => {}); // Ensure void return
  }
  public async close() {
    const server = await this.testServerPromise;
    if (this.chrome) {
      await this.chrome.close();
      await this.chrome.dispose();
    }
    return server.close();
  }

  private async runTest(
    browser: RootConnection,
    test: (appEnv: TestEnvironment<S>) => Promise<void>,
    server: S
  ) {

    browser.on('error', err => {
      // underlying connection error or error dispatching events.
      console.error(`connection error ${err.stack}`);
    });

    const { browserContextId } = await addTimeout(browser.send('Target.createBrowserContext'),
      'Browser context creation timed out', 5000);

    const testEnv = new TestEnvironment(browser, server, browserContextId);

    await test(testEnv);

    await testEnv.close();

    await browser.send('Target.disposeBrowserContext', {
      browserContextId
    });
  }

  private async runWithBrowser(cb: (browser: RootConnection) => Promise<void>, options?: Partial<SpawnOptions>) {
    if (options) {
      // If the individual test wants to customize the chrome instance, then we need to spin up a separate
      // chrome browser just for this test
      const chrome = spawnChrome(Object.assign({}, this.sessionOptions.browserOptions, options));
      await cb(chrome.connection);
      await chrome.close();
      await chrome.dispose();
    } else {
      this.chrome = this.chrome || spawnChrome(this.sessionOptions.browserOptions);
      await cb(this.chrome.connection);
    }
  }

  public async run(test: (appEnv: TestEnvironment<S>) => Promise<void>, options?: Partial<SpawnOptions>) {
    const server = await addTimeout(this.testServerPromise, 'Test server timeout', 10000);
    this.log('Test server started');

    await this.runWithBrowser((browser) => {
      return this.runTest(browser, test, server);
    }, options);
    await server.reset();
  }
}