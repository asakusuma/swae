import { IAPIClient, ISession, ITabResponse, IDebuggingProtocolClient } from 'chrome-debugging-client';
import { ClientEnvironment } from './models/client';
import { TestServerApi } from './test-server-api';
import { Target } from 'chrome-debugging-client/dist/protocol/tot';

/**
 * API for interacting with the complete running test application
 * @remarks
 * This is the main point of interaction between test code and swae
 * @public
 */
export class TestEnvironment<S extends TestServerApi = TestServerApi> {
  private client: IAPIClient;
  private session: ISession;
  private testServer: S;
  private activeClient: ClientEnvironment;

  private tabIdToClientEnv: {[tabId: string]: ClientEnvironment};

  private browserClient: IDebuggingProtocolClient;

  private constructor(client: IAPIClient, browserClient: IDebuggingProtocolClient, session: ISession, testServer: S) {
    this.client = client;
    this.session = session;
    this.testServer = testServer;
    this.tabIdToClientEnv = {};
    this.browserClient = browserClient;
  }

  public static async build<S extends TestServerApi = TestServerApi>
    (client: IAPIClient, browserClient: IDebuggingProtocolClient, session: ISession, testServer: S) {
    const tabs = await client.listTabs();
    const initialTab = tabs[0];

    const appEnv = new TestEnvironment(client, browserClient, session, testServer);
    await appEnv.buildClientEnv(initialTab);
    await appEnv.activateTab(initialTab.id);
    return appEnv;
  }

  public getActiveTabClient(): ClientEnvironment {
    return this.activeClient;
  }

  public getTestServer(): S {
    return this.testServer;
  }

  public async createTab(): Promise<ClientEnvironment> {
    const tab = await this.client.newTab();
    return this.buildClientEnv(tab);
  }

  public activateTabById(id: string) {
    return this.activateTab(id);
  }

  public async createAndActivateTab() {
    await this.createTab();
    await this.activateLastTab();
    return this.getActiveTabClient();
  }

  private async getTabs() {
    const tabs = await this.client.listTabs();
    return tabs.filter(({ type }) => {
      return type === 'page';
    });
  }

  // This method is probably broken
  public async activateTabByIndex(index: number) {
    const tabs = await this.getTabs();
    const rawIndex = tabs.length - 1 - index;
    if (rawIndex >= 0) {
      return this.activateTabById(tabs[rawIndex].id);
    }
  }

  public async activateLastTab() {
    const tabs = await this.getTabs();
    if (tabs.length > 0) {
      const last = tabs[0];
      return this.activateTabById(last.id);
    }
  }

  public async autoAttach() {
    const target = new Target(this.browserClient);
    target.receivedMessageFromTarget = (msg) => {
      console.log('msg', msg.message);
    };
    target.attachedToTarget = (attached) => {
      console.log('attached', attached);
    };
    await target.setAutoAttach({
      autoAttach: true,
      waitForDebuggerOnStart: false
    });
  }

  public async closeTab() {
    // TODO: Call ensureNoErrors() on the tab
  }

  public async close() {
    const tabIds = Object.keys(this.tabIdToClientEnv);
    return Promise.all(tabIds.map((tabId) => {
      return this.tabIdToClientEnv[tabId].close();
    }));
  }

  public async activateTabClient(client: ClientEnvironment) {
    await this.activateTabById(client.tab.id);
  }

  private async buildClientEnv(tab: ITabResponse): Promise<ClientEnvironment> {
    const dp = await this.session.openDebuggingProtocol(tab.webSocketDebuggerUrl || '');
    const client = await ClientEnvironment.build(dp, this.testServer.rootUrl, tab);
    this.tabIdToClientEnv[tab.id] = client;
    return client;
  }

  private async activateTab(tabId: string) {
    await this.client.activateTab(tabId);
    this.activeClient = this.tabIdToClientEnv[tabId];
  }
}

