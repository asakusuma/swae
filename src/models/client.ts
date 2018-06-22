import {
  Page,
  ServiceWorker,
  IndexedDB,
  CacheStorage,
  Network,
  Runtime
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient, ISession } from 'chrome-debugging-client';
import { ServiceWorkerState } from './service-worker-state';
import { FrameStore, NavigateResult } from './frame';

/**
 * @public
 */
export interface EvaluateFunction {
  <T>(toEvaluate: () => T): Promise<T>;
}

export interface TypedRemoteObject<T> extends Runtime.RemoteObject {
  value: T;
}

export interface TypedAwaitPromiseReturn<T> extends Runtime.AwaitPromiseReturn {
  result: TypedRemoteObject<T>;
}

function exceptionDetailsToError({ exception, text, stackTrace }: Runtime.ExceptionDetails) {
  const msg = (exception ? exception.description : text) || text;
  const err = new Error(`Client Evaluation Failed: ${msg}`);
  if (stackTrace) {
    err.stack = stackTrace.callFrames.join('\n');
  }
  return err;
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


interface NavigateOptions {
  targetUrl?: string;
  waitForLoad?: boolean;
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
    this.page.loadEventFired = this.frameStore.onLoadEvent.bind(this.frameStore);
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

  public async evaluate<T>(code: string | (() => T)): Promise<TypedRemoteObject<T>> {
    const expression = typeof code === 'string' ? code : `(${code.toString()}())`;
    const {
      result,
      exceptionDetails
    } = await this.tabClient.send<TypedAwaitPromiseReturn<T>>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      silent: false
    });
    if (exceptionDetails) {
      throw exceptionDetailsToError(exceptionDetails);
    }
    return result;
  }

  public getStorageEstimate() {
    return this.evaluate(function getStorageEstimate() {
      return (navigator as any).storage.estimate().then((stats: { quota: number, usage: number}) => {
        return JSON.stringify(stats);
      });
    });
  }

  public async ensureMaximumStorageAvailable(bytesAvailable: number) {
    const functionString = function() {
      function getAvailable() {
        return (navigator as any).storage.estimate().then((stats: { quota: number, usage: number}) => {
          return stats.quota - stats.usage;
        });
      }
      function generateString(size: number) {
        let str = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < size; i++) {
          str += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return str;
      }
      return caches.open('test-cache').then(async (cache) => {
        let available = -1;
        let iterations = 0;
        do {
          await cache.put(generateString(20), new Response(new Blob([generateString(999)])));
          available = await getAvailable();
          iterations++;
        } while (available > bytesAvailable);
        return JSON.stringify({
          iterations,
          available
        });
      });
    }.toString();
    // Hacky way of injecting bytesAvailable parameter
    const paramsInjected = functionString.replace(/bytesAvailable/, String(bytesAvailable));
    return this.evaluate(`(${paramsInjected})();`);
  }

  public async emulateOffline() {
    throw new Error('Offline emulation not working. See https://bugs.chromium.org/p/chromium/issues/detail?id=852127');
    /*
    await this.network.emulateNetworkConditions({
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });
    */
  }

  public async clearBrowserCache() {
    await this.network.clearBrowserCache();
  }

  public async navigate(arg?: string | NavigateOptions): Promise<NavigateResult> {
    const targetUrl = arg ? typeof arg === 'string' ? arg : arg.targetUrl : null;
    const url = targetUrl ? this.getAbsoluteUrl(targetUrl) : this.rootUrl;
    const waitForLoad = typeof arg === 'object' && arg.waitForLoad;

    const tree = await this.page.getFrameTree();
    const frameId = tree.frameTree.frame.id;

    const navPromise = this.frameStore.start(frameId, waitForLoad);
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