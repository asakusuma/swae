import { IDebuggingProtocolClient, IConnection, ISession } from 'chrome-debugging-client';
import { ClientEnvironment } from './models/client';
import { TestServerApi } from './test-server-api';
import { Target } from 'chrome-debugging-client/dist/protocol/tot';
import { clientEmulateOffline } from './utils';

/**
 * API for interacting with the complete running test application
 * @remarks
 * This is the main point of interaction between test code and swae
 * @public
 */
export class TestEnvironment<S extends TestServerApi = TestServerApi> {
  private testServer: S;
  private activeClient: ClientEnvironment;
  private targetDomain: Target;
  private session: ISession;

  private browserContextId: string;

  private targetIdToClientEnv: {[targetId: string]: ClientEnvironment};
  private clientEnvIndex: ClientEnvironment[];

  private browserClient: IDebuggingProtocolClient;

  private constructor(browserClient: IDebuggingProtocolClient, session: ISession, testServer: S) {
    this.testServer = testServer;
    this.targetIdToClientEnv = {};
    this.clientEnvIndex = [];
    this.browserClient = browserClient;
    this.targetDomain = new Target(browserClient);
    this.session = session;
  }

  public async createTarget(): Promise<ClientEnvironment> {
    const { targetId } = await this.targetDomain.createTarget({
      browserContextId: this.browserContextId,
      url: 'about:blank',
    });
    const connection = await this.session.attachToTarget(this.browserClient, targetId);
    const env = await this.buildClientEnv(connection, targetId);
    this.clientEnvIndex.push(env);
    if (!this.activeClient) {
      this.activeClient = env;
    }
    return env;
  }

  public async createBrowserContext() {
    this.browserContextId = (await this.targetDomain.createBrowserContext()).browserContextId;
  }

  public async activateTabByIndex(index: number) {
    if (index < 0 || index >= this.clientEnvIndex.length) {
      throw new Error('Invalid tab index');
    }
    await this.activateTabClient(this.clientEnvIndex[index]);
  }

  public static async build<S extends TestServerApi = TestServerApi>
    (browserClient: IDebuggingProtocolClient, session: ISession, testServer: S) {
    const appEnv = new TestEnvironment(browserClient, session, testServer);
    await appEnv.createBrowserContext();
    return appEnv;
  }

  public getActiveTabClient(): ClientEnvironment {
    return this.activeClient;
  }

  public getTestServer(): S {
    return this.testServer;
  }

  public async createTab(): Promise<ClientEnvironment> {
    return this.createTab();
  }

  public activateTabById(id: string) {
    return this.activateTab(id);
  }

  public async emulate() {
    /*
    const network = new Network(this.browserClient);
    await network.enable({});
    await network.emulateNetworkConditions({
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
    */
    await clientEmulateOffline(this.session, this.browserClient);
  }

  public async createAndActivateTab() {
    const tab = await this.createTarget();
    await this.activateTabClient(tab);
    return tab;
  }

  public async closeTab() {
    // TODO: Call ensureNoErrors() on the tab
  }

  public async close() {
    const targetIds = Object.keys(this.targetIdToClientEnv);
    return Promise.all(targetIds.map((targetId) => {
      return this.targetIdToClientEnv[targetId].close();
    }));
  }

  public async activateTabClient(client: ClientEnvironment) {
    await this.activateTabById(client.targetId);
  }

  private async buildClientEnv(connection: IConnection, targetId: string): Promise<ClientEnvironment> {
    const client = await ClientEnvironment.build(connection, this.testServer.rootUrl, targetId);
    this.targetIdToClientEnv[targetId] = client;
    return client;
  }

  private async activateTab(targetId: string) {
    const client = this.targetIdToClientEnv[targetId];
    this.activeClient = client;
    // TODO: Migrate to sessionID
    await this.targetDomain.activateTarget({ targetId });
  }
}

