import {
  Page,
  ServiceWorker,
  IndexedDB,
  CacheStorage,
  Network,
  Target
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient, ISession } from 'chrome-debugging-client';
import createTargetConnection from 'chrome-debugging-client/dist/lib/create-target-connection';

import { ServiceWorkerState } from './service-worker-state';
import { FrameStore, NavigateResult } from './frame';
import { emulateOffline, turnOffEmulateOffline } from '../utils';

/**
 * @public
 */
export interface EvaluateFunction {
  <T>(toEvaluate: () => T): Promise<T>;
}

/**
 * Models a particular client, usually a Chrome tab
 * @public
 */
export class ClientEnvironment {
  public swState: ServiceWorkerState;
  public page: Page;
  public cacheStorage: CacheStorage;
  public indexedDB: IndexedDB;
  public network: Network;
  public serviceWorker: ServiceWorker;
  public rootUrl: string;
  public targetId: string;

  private tabClient: IDebuggingProtocolClient;
  private frameStore: FrameStore;

  private constructor(
    session: ISession,
    browserClient: IDebuggingProtocolClient,
    tabClient: IDebuggingProtocolClient,
    rootUrl: string,
    targetId: string
  ) {
    this.rootUrl = rootUrl;
    this.tabClient = tabClient;
    this.serviceWorker = new ServiceWorker(tabClient);
    this.page = new Page(tabClient);
    this.indexedDB = new IndexedDB(tabClient);
    this.cacheStorage = new CacheStorage(tabClient);
    this.network = new Network(tabClient);
    this.swState = new ServiceWorkerState(session, browserClient, this.serviceWorker);

    this.frameStore = new FrameStore();

    this.network.responseReceived = this.frameStore.onNetworkResponse.bind(this.frameStore);
    this.page.frameNavigated = this.frameStore.onNavigationComplete.bind(this.frameStore);
    this.targetId = targetId;
  }

  public static async build(
    session: ISession,
    browserClient: IDebuggingProtocolClient,
    tabClient: IDebuggingProtocolClient,
    rootUrl: string,
    targetId: string
  ) {
    const instance = new ClientEnvironment(session, browserClient, tabClient, rootUrl, targetId);
    await Promise.all([
      instance.page.enable(),
      instance.serviceWorker.enable(),
      instance.indexedDB.enable(),
      instance.network.enable({})
    ]);
    return instance;
  }

  public debug() {
    this.swState.debug();
  }

  public async close() {
    await Promise.all([
      this.page.disable(),
      this.serviceWorker.disable(),
      this.indexedDB.disable(),
      this.network.disable()
    ]);
    this.swState.ensureNoErrors();
  }

  public waitForServiceWorkerRegistration() {
    return this.evaluate(function() {
      // TODO: Figure out how to evaluate browser code without having to add the 'dom'
      // typescript library in tsconfig
      return navigator.serviceWorker.ready.then(() => {
        return navigator.serviceWorker.getRegistration();
      });
    });
  }

  public evaluate<T>(code: string | (() => T)): Promise<T> {
    const expression = typeof code === 'string' ? code : `(${code.toString()}())`;
    return this.tabClient.send('Runtime.evaluate', {
      expression,
      awaitPromise: true
    });
  }

  public async emulateOffline(offline: boolean) {
    if (offline) {
      await emulateOffline(this.network);
    } else {
      await turnOffEmulateOffline(this.network);
    }
    await this.swState.emulateOffline(offline);
  }

  public async clearBrowserCache() {
    await this.network.clearBrowserCache();
  }

  public async disableCache() {
    await this.network.setCacheDisabled({
      cacheDisabled: true
    });
  }

  public async reload() {
    await this.page.reload({
      ignoreCache: true
    });
  }

  public async navigate(targetUrl?: string): Promise<NavigateResult> {
    const url = targetUrl ? this.getAbsoluteUrl(targetUrl) : this.rootUrl;

    const tree = await this.page.getFrameTree();
    const frameId = tree.frameTree.frame.id;

    const navPromise = this.frameStore.start(frameId);
    await this.page.navigate({ url });

    const { networkResult, frame } = await navPromise;

    const body = await this.network.getResponseBody({
      requestId: networkResult.requestId
    });

    return {
      networkResult,
      frame,
      body
    };
  }

  private getAbsoluteUrl(targetUrl: string) {
    if (isAbsolutePath(targetUrl)) {
      return targetUrl;
    }
    return this.rootUrl + targetUrl;
  }
}

function isAbsolutePath(url: string) {
  if (url.length < 8 || url.substr(0, 1) === '/') {
    return false;
  } else if (url.substr(0, 7) === 'http://') {
    return true;
  } else if (url.substr(0, 8) === 'https://') {
    return true;
  }
  return false;
}

export async function autoAttach(debuggerClient: IDebuggingProtocolClient, host: string, port: number) {
  const target = new Target(debuggerClient);
  await target.setDiscoverTargets({
    discover: true
  });
  target.targetCreated = (targetz) => {
  };
  target.attachedToTarget = async (attached) => {
    const connection = createTargetConnection(debuggerClient, attached.sessionId);
    await autoAttach(connection, host, port);
  };
  await target.setAutoAttach({
    autoAttach: true,
    waitForDebuggerOnStart: false
  });
}