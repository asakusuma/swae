import { RootConnection, SessionConnection } from 'chrome-debugging-client';
import { TestServerApi } from './test-server-api';
import Protocol from 'devtools-protocol';
import {
  FrameStore
} from './models/frame';
import { ServiceWorkerState } from './models/service-worker-state';
// import { Target } from 'chrome-debugging-client/dist/protocol/tot';
// import { Target } from 'devtools-protocol';


export interface EvaluateFunction {
  <T>(toEvaluate: () => T): Promise<T>;
}

export interface TypedRemoteObject<T> extends Protocol.Runtime.RemoteObject {
  value: T;
}

function exceptionDetailsToError({ exception, text, stackTrace }: Protocol.Runtime.ExceptionDetails) {
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

export interface NavigateOptions {
  targetUrl?: string;
}

export interface PageLoadResult {
  page: CapturedResponse;
  childResponses: CapturedResponseHash;
  frame: Protocol.Page.Frame;
}

export interface CapturedResponseHash {
  [url: string]: CapturedResponse;
}

export interface CapturedResponse {
  responseMeta: Protocol.Network.Response;
  body: string;
}

export interface PageNavigateResult {
  page: CapturedResponse;
  frame: Protocol.Page.Frame;
}

export interface TargetOptions {
  rootUrl: string;
  log?: boolean;
}

export class Target {
  private browserConnection: RootConnection;
  private targetId: string;
  private frameStore: FrameStore;
  private options: TargetOptions;

  public rootUrl: string;
  public page: SessionConnection;
  public swState: ServiceWorkerState;

  private constructor(
    browserConnection: RootConnection, page: SessionConnection, targetId: string, options: TargetOptions) {
    this.browserConnection = browserConnection;
    this.targetId = targetId;
    this.frameStore = new FrameStore();
    this.options = options;
    this.rootUrl = options.rootUrl;
    this.page = page;

    this.swState = new ServiceWorkerState(this.page, this.options);

    // this.browserConnection.on('Network.responseReceived', this.frameStore.onNetworkResponse.bind(this.frameStore));

    this.page.on('Network.responseReceived', this.frameStore.onNetworkResponse.bind(this.frameStore));
    this.page.on('Network.requestWillBeSent', this.frameStore.onRequestWillBeSent.bind(this.frameStore));
    this.page.on('Page.frameNavigated', this.frameStore.onNavigationComplete.bind(this.frameStore));
    this.page.on('Page.loadEventFired', this.frameStore.onLoadEvent.bind(this.frameStore));
  }

  public async evaluate<T>(code: string | (() => T)): Promise<Protocol.Runtime.RemoteObject> {
    const expression = typeof code === 'string' ? code : `(${code.toString()}())`;
    const { result, exceptionDetails } = await this.page.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      silent: false
    });

    if (exceptionDetails) {
      throw exceptionDetailsToError(exceptionDetails);
    }

    return result;
  }

  public async activate() {
    return this.browserConnection.send('Target.activateTarget', { targetId: this.targetId });
  }

  public static async create(browserConnection: RootConnection, browserContextId: string, options: TargetOptions) {
    const { targetId } = await browserConnection.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId
    });
    const page = await browserConnection.attachToTarget(targetId);
    await Promise.all([
      page.send('Page.enable'),
      page.send('Network.enable'),
      page.send('ServiceWorker.enable')
    ]);
    const target = new Target(browserConnection, page, targetId, options);

    // await target.setupListeners();

    return target;
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

  public async navigate(arg?: string) {
    const url = arg ? this.getAbsoluteUrl(arg) : this.rootUrl;
    await Promise.all([
      this.page.until('Page.loadEventFired'),
      this.page.send('Page.navigate', { url }),
    ]);
  }

  private getAbsoluteUrl(targetUrl: string) {
    if (isAbsolutePath(targetUrl)) {
      return targetUrl;
    }
    return this.rootUrl + targetUrl;
  }

  private async buildCapturedResponse(response: Protocol.Network.ResponseReceivedEvent): Promise<CapturedResponse> {
    return {
      responseMeta: response.response,
      body: (await this.page.send('Network.getResponseBody', {requestId: response.requestId})).body
    };
  }

  // Regular navigate, but also collect all asset requests made
  private async navigateWithAssets(arg?: string | NavigateOptions) {
    const targetUrl = arg ? typeof arg === 'string' ? arg : arg.targetUrl : null;
    const url = targetUrl ? this.getAbsoluteUrl(targetUrl) : this.rootUrl;

    const tree = await this.page.send('Page.getResourceTree');
    const frame = tree.frameTree.frame;

    const navPromise = this.frameStore.start(frame.id, true);

    const { errorText } = await this.page.send('Page.navigate', { url });
    if (errorText) {
      console.error(`Navigation Failed: ${errorText}`);
    }
    const responses = await navPromise;
    const page = await this.buildCapturedResponse(this.findPageResponse(responses, url));
    return { responses, page, frame};
  }

  private findResponse(responses: Protocol.Network.ResponseReceivedEvent[], url: string) {
    return responses.find((item) => { return item.response.url === url; });
  }

  private findPageResponse(responses: Protocol.Network.ResponseReceivedEvent[], url: string) {
    const urlResult = this.findResponse(responses, url);
    if (urlResult) {
      return urlResult;
    }

    const slashedUrl = `${url}/`;
    const slashedUrlResult = this.findResponse(responses, slashedUrl);
    if (slashedUrlResult) {
      return slashedUrlResult;
    }

    throw new Error(`Couldn't match shell url (${url}) to a captured response`);
  }

  /**
   * Load page in active tab. Resolves once both the page's load event is fired and all asset responses are recieved.
   * To wait only for initial HTTP response, use navigate() method instead.
   * * @return All asset responses and page frame data
   */
  public async load(arg?: string | NavigateOptions): Promise<PageLoadResult> {
    const { responses, page, frame } = await this.navigateWithAssets(arg);

    const capturedResponses: CapturedResponse[] = await Promise.all(responses.map((response) => {
      return this.buildCapturedResponse(response);
    }));

    const childResponses = capturedResponses.reduce((responseHash, response) => {
      // We already have the page response as a separate object, don't include it here
      if (response.responseMeta.url !== page.responseMeta.url) {
        responseHash[response.responseMeta.url] = response;
      }
      return responseHash;
    }, {} as CapturedResponseHash);
    return {
      page,
      childResponses,
      frame
    };
  }

  async close() {
    this.swState.ensureNoErrors();
    this.swState.close();
    await this.page.send('ServiceWorker.stopAllWorkers');
    await this.page.send('ServiceWorker.unregister', {
      scopeURL: this.rootUrl
    });
    return this.browserConnection.send('Target.closeTarget', {
      targetId: this.targetId
    });
  }
}

/**
 * API for interacting with the complete running test application
 * @remarks
 * This is the main point of interaction between test code and swae
 * @public
 */
export class TestEnvironment<S extends TestServerApi = TestServerApi> {
  private testServer: S;
  private browserConnection: RootConnection;

  private browserContextId: string;

  private tabIndex: Target[];
  private activeTarget: Target;

  constructor(browserConnection: RootConnection, testServer: S, browserContextId: string) {
    this.testServer = testServer;
    this.browserConnection = browserConnection;
    this.browserContextId = browserContextId;
    this.tabIndex = [];
  }

  public async createTab(debug?: boolean): Promise<Target> {
    const target = await Target.create(this.browserConnection, this.browserContextId, {
      rootUrl: this.testServer.rootUrl,
      log: debug
    });
    this.tabIndex.push(target);
    await target.activate();
    this.activeTarget = target;
    return target;
  }

  public getTestServer(): S {
    return this.testServer;
  }

  public async activateTabByIndex(index: number) {
    if (index < 0 || index >= this.tabIndex.length || !this.tabIndex[index]) {
      throw new Error('Invalid tab index');
    }
    await this.activateTarget(this.tabIndex[index]);
  }

  private async activateTarget(target: Target) {
    await target.activate();
    this.activeTarget = target;
  }


  public async close() {
    await Promise.all(this.tabIndex.map((target) => target.close()));
  }

  public getActiveTab(): Target {
    if (!this.activeTarget) {
      throw new Error(`No active tab client exists. Have you tried creating one first?
        You can do so using TestEnvironment.createTarget()`);
    }
    return this.activeTarget;
  }

  public async activateTab(target: Target) {
    const t = this.tabIndex.find((tab) => tab === target);
    if (t) {
      await this.activateTarget(t);
    }
  }


/*

  public async createTab(): Promise<ClientEnvironment> {
    return this.createTab();
  }

  public async emulateOffline(offline: boolean = true) {
    throw new Error('Offline emulation not working. See https://bugs.chromium.org/p/chromium/issues/detail?id=852127');

    //await Promise.all(this.clientEnvIndex.map((client) => {
    //  return client.emulateOffline(offline);
    //}));
  }

  public async createAndActivateTab() {
    const tab = await this.createTarget();
    await this.activateTabClient(tab);
    return tab;
  }

  public async closeTab(targetId: string) {
    if (!(targetId in this.targetIdToClientEnv)) {
      throw new Error(`Can't close tab with targetId:{$targetId}. ` +
                      'This targetId is not associated with this TestEnvironment');
    }
    await this.targetIdToClientEnv[targetId].close();
    delete this.targetIdToClientEnv[targetId];
  }

  public async close() {
    const targetIds = Object.keys(this.targetIdToClientEnv);
    return Promise.all(targetIds.map((targetId) => {
      return this.closeTab(targetId);
    }));
  }

  public async activateTabClient(client: ClientEnvironment) {
    await this.activateTabById(client.targetId);
  }

  private async buildClientEnv(targetClient: IDebuggingProtocolClient, targetId: string): Promise<ClientEnvironment> {
    const client = await ClientEnvironment.build(
      this.session, this.browserClient, targetClient, this.testServer.rootUrl, targetId);
    this.targetIdToClientEnv[targetId] = client;
    return client;
  }
  */
}

