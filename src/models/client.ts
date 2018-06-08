import {
  Page,
  ServiceWorker,
  IndexedDB,
  CacheStorage,
  Network,
  Target
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient } from 'chrome-debugging-client';
import createTargetConnection from 'chrome-debugging-client/dist/lib/create-target-connection';

import { ServiceWorkerState } from './service-worker-state';
import { FrameStore, NavigateResult } from './frame';

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

  private debuggerClient: IDebuggingProtocolClient;
  private frameStore: FrameStore;

  private constructor(debuggerClient: IDebuggingProtocolClient, rootUrl: string, targetId: string) {
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

  public debug() {
    this.swState.debug();
  }

  public static async build(debuggerClient: IDebuggingProtocolClient, rootUrl: string, targetId: string) {
    const instance = new ClientEnvironment(debuggerClient, rootUrl, targetId);
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
    return this.debuggerClient.send('Runtime.evaluate', {
      expression,
      awaitPromise: true
    });
  }

  public async emulateOffline() {
    await this.network.emulateNetworkConditions({
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
  }

  public async turnOffEmulateOffline() {
    await this.network.emulateNetworkConditions({
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
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
  await target.setRemoteLocations({
    locations: [{
      host,
      port
    }]
  });
  target.targetCreated = (targetz) => {
    console.log('created', targetz);
  };
  target.attachedToTarget = async (attached) => {
    console.log('attached', attached.sessionId, attached.targetInfo.type, attached.targetInfo.title);
    const connection = createTargetConnection(debuggerClient, attached.sessionId);
    await autoAttach(connection, host, port);
  };
  await target.setAutoAttach({
    autoAttach: true,
    waitForDebuggerOnStart: false
  });
}