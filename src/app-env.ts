import { IAPIClient, ISession, ITabResponse } from 'chrome-debugging-client';
import { ClientEnvironment } from './models/client';
import { emulateOffline, turnOffEmulateOffline, HasNetwork } from './utils';
import { ServiceWorkerEnvironment } from './models/service-worker-client';
import { TestServerApi } from './test-server-api';

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
  private targetIdToServiceWorkerEnv: {[targetId: string]: ServiceWorkerEnvironment};

  private constructor(client: IAPIClient, session: ISession, testServer: S) {
    this.client = client;
    this.session = session;
    this.testServer = testServer;
    this.tabIdToClientEnv = {};
    this.targetIdToServiceWorkerEnv = {};
  }

  public static async build<S extends TestServerApi = TestServerApi>
    (client: IAPIClient, session: ISession, testServer: S) {
    const tabs = await client.listTabs();
    const initialTab = tabs[0];

    const appEnv = new TestEnvironment(client, session, testServer);
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

  private async getServiceWorkers() {
    const tabs = await this.client.listTabs();
    return tabs.filter(({ type }) => {
      return type === 'service_worker';
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

  public async getServiceWorkerEnvironment(target: string | ITabResponse): Promise<ServiceWorkerEnvironment> {
    const targetId = typeof target === 'string' ? target : target.id;
    const sw = this.targetIdToServiceWorkerEnv[targetId];
    if (sw) {
      return Promise.resolve(sw);
    }
    const worker = typeof target !== 'string' ? target : (await this.getServiceWorkers()).find((w) => {
      return w.id === targetId;
    });
    if (!worker) {
      throw new Error(`Could not find service worker with targetId ${targetId}`);
    }
    const dp = await this.session.openDebuggingProtocol(worker.webSocketDebuggerUrl || '');
    return ServiceWorkerEnvironment.build(dp);
  }

  private async getServiceWorkerEnvironments() {
    const workers = await this.getServiceWorkers();
    return Promise.all(workers.map((w) => this.getServiceWorkerEnvironment(w)));
  }

  private async getClientEnvironments() {
    const workers = this.getServiceWorkerEnvironments();
    const tabs = Object.keys(this.tabIdToClientEnv)
      .map((key) => this.tabIdToClientEnv[key]);

    const combined: HasNetwork[][] = await Promise.all([tabs, workers]);
    return combined[0].concat(combined[1]);
  }

  public async emulateOffline() {
    return (await this.getClientEnvironments()).map(emulateOffline);
  }

  public async turnOffEmulateOffline() {
    return (await this.getClientEnvironments()).map(turnOffEmulateOffline);
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

