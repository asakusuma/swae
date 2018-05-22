import { IAPIClient, ISession, ITabResponse } from 'chrome-debugging-client';
import { ClientEnvironment } from './models/client';
import { TestServerApi } from './test-server-api';

export class ApplicationEnvironment<S extends TestServerApi = TestServerApi> {
  private client: IAPIClient;
  private session: ISession;
  private testServer: S;
  private activeClient: ClientEnvironment;

  private tabIdToClientEnv: {[tabId: string]: ClientEnvironment};

  private constructor(client: IAPIClient, session: ISession, testServer: S) {
    this.client = client;
    this.session = session;
    this.testServer = testServer;
    this.tabIdToClientEnv = {};
  }

  public static async build<S extends TestServerApi = TestServerApi>
    (client: IAPIClient, session: ISession, testServer: S) {
    const tabs = await client.listTabs();
    const initialTab = tabs[0];

    const appEnv = new ApplicationEnvironment(client, session, testServer);
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

  public async newTab(): Promise<ClientEnvironment> {
    const tab = await this.client.newTab();
    return this.buildClientEnv(tab);
  }

  public openTabById(id: string) {
    return this.activateTab(id);
  }

  public async openAndActivateTab() {
    await this.newTab();
    await this.openLastTab();
    return this.getActiveTabClient();
  }

  private async getTabs() {
    const tabs = await this.client.listTabs();
    return tabs.filter(({ type }) => {
      return type === 'page';
    });
  }

  public async openTabByIndex(index: number) {
    const tabs = await this.getTabs();
    const rawIndex = tabs.length - 1 - index;
    if (rawIndex >= 0) {
      return this.openTabById(tabs[rawIndex].id);
    }
  }

  public async openLastTab() {
    const tabs = await this.getTabs();
    if (tabs.length > 0) {
      const last = tabs[0];
      return this.openTabById(last.id);
    }
  }

  private async buildClientEnv(tab: ITabResponse): Promise<ClientEnvironment> {
    const dp = await this.session.openDebuggingProtocol(tab.webSocketDebuggerUrl || '');
    const client = await ClientEnvironment.build(dp, this.testServer.rootUrl);
    this.tabIdToClientEnv[tab.id] = client;
    return client;
  }

  private async activateTab(tabId: string) {
    await this.client.activateTab(tabId);
    this.activeClient = this.tabIdToClientEnv[tabId];
  }
}

