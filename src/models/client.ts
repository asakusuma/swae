import {
  Page,
  ServiceWorker,
  IndexedDB,
  CacheStorage,
  Network
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient } from 'chrome-debugging-client';

import { ServiceWorkerState } from './service-worker-state';
import { FrameStore, NavigateResult } from './frame';

function runtimeEvaluate<T>(client: IDebuggingProtocolClient, func: () => T) {
  return client.send<T>('Runtime.evaluate', {
    expression: `(${func.toString()}())`,
    awaitPromise: true
  });
}

export interface EvaluateFunction {
  <T>(toEvaluate: () => T): Promise<T>;
}

export class ClientEnvironment {
  public swState: ServiceWorkerState;
  public page: Page;
  public cacheStorage: CacheStorage;
  public indexedDB: IndexedDB;
  public network: Network;
  public serviceWorker: ServiceWorker;
  public rootUrl: string;

  private debuggerClient: IDebuggingProtocolClient;
  private frameStore: FrameStore;

  private constructor(debuggerClient: IDebuggingProtocolClient, rootUrl: string) {
    this.rootUrl = rootUrl;
    this.debuggerClient = debuggerClient;
    this.serviceWorker = new ServiceWorker(debuggerClient);
    this.page = new Page(debuggerClient);
    this.indexedDB = new IndexedDB(debuggerClient);
    this.cacheStorage = new CacheStorage(debuggerClient);
    this.network = new Network(debuggerClient);
    this.swState = new ServiceWorkerState(this.serviceWorker);

    this.frameStore = new FrameStore();

    this.network.responseReceived = this.frameStore.onNetworkResponse.bind(this.frameStore);
    this.page.frameNavigated = this.frameStore.onNavigationComplete.bind(this.frameStore);
  }

  public static async build(debuggerClient: IDebuggingProtocolClient, rootUrl: string) {
    const instance = new ClientEnvironment(debuggerClient, rootUrl);
    await Promise.all([
      instance.page.enable(),
      instance.serviceWorker.enable(),
      instance.indexedDB.enable(),
      instance.network.enable({})
    ]);
    return instance;
  }

  public async close() {
    await Promise.all([
      this.page.disable(),
      this.serviceWorker.disable(),
      this.indexedDB.disable(),
      this.network.disable()
    ]);
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

  public evaluate<T>(toEvaluate: () => T) {
    return runtimeEvaluate(this.debuggerClient, toEvaluate);
  }

  public async navigate(targetUrl?: string): Promise<NavigateResult> {
    const url = targetUrl ? this.getAbsoluteUrl(targetUrl) : this.rootUrl;

    const tree = await this.page.getFrameTree();
    const frameId = tree.frameTree.frame.id;

    const navPromise = this.frameStore.start(frameId);
    this.page.navigate({ url });

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
  if (url.length < 8 || url.substr(0,1) === '/') {
    return false;
  } else if (url.substr(0,7) === 'http://') {
    return true;
  } else if (url.substr(0,8) === 'https://') {
    return true;
  }
  return false;
}