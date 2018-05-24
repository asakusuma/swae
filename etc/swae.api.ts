// @public
class ClientEnvironment {
  // (undocumented)
  static build(debuggerClient: IDebuggingProtocolClient, rootUrl: string): Promise<ClientEnvironment>;
  // (undocumented)
  cacheStorage: CacheStorage;
  // (undocumented)
  close(): Promise<void>;
  // (undocumented)
  evaluate<T>(toEvaluate: () => T): Promise<T>;
  // (undocumented)
  indexedDB: IndexedDB;
  // (undocumented)
  navigate(targetUrl?: string): Promise<NavigateResult>;
  // (undocumented)
  network: Network;
  // (undocumented)
  page: Page;
  // (undocumented)
  rootUrl: string;
  // (undocumented)
  serviceWorker: ServiceWorker;
  // (undocumented)
  swState: ServiceWorkerState;
  // (undocumented)
  waitForServiceWorkerRegistration(): Promise<Promise<ServiceWorkerRegistration | undefined>>;
}

// @public (undocumented)
interface EvaluateFunction {
  // (undocumented)
  <T>(toEvaluate: () => T): Promise<T>;
}

// @public
class FrameNavigation {
  constructor();
  // (undocumented)
  getPromise(): Promise<PageNavigateResult>;
  // (undocumented)
  onNavigationComplete({frame}: Page.FrameNavigatedParameters): void;
  // (undocumented)
  onNetworkResponse(res: Network.ResponseReceivedParameters): void;
}

// @public
class FrameStore {
  constructor();
  // (undocumented)
  onNavigationComplete(result: Page.FrameNavigatedParameters): void;
  // (undocumented)
  onNetworkResponse(res: Network.ResponseReceivedParameters): void;
  // (undocumented)
  start(frameId: string): Promise<PageNavigateResult>;
}

// @public
interface IServiceWorker {
  // (undocumented)
  deliverPushMessage?: (params: ServiceWorker.DeliverPushMessageParameters) => Promise<void>;
  // (undocumented)
  disable?: () => Promise<void>;
  // (undocumented)
  dispatchSyncEvent?: (params: ServiceWorker.DispatchSyncEventParameters) => Promise<void>;
  // (undocumented)
  enable?: () => Promise<void>;
  // (undocumented)
  inspectWorker?: (params: ServiceWorker.InspectWorkerParameters) => Promise<void>;
  // (undocumented)
  setForceUpdateOnPageLoad?: (params: ServiceWorker.SetForceUpdateOnPageLoadParameters) => Promise<void>;
  // (undocumented)
  skipWaiting: (params: ServiceWorker.SkipWaitingParameters) => Promise<void>;
  // (undocumented)
  startWorker?: (params: ServiceWorker.StartWorkerParameters) => Promise<void>;
  // (undocumented)
  stopAllWorkers?: () => Promise<void>;
  // (undocumented)
  stopWorker?: (params: ServiceWorker.StopWorkerParameters) => Promise<void>;
  // (undocumented)
  unregister?: (params: ServiceWorker.UnregisterParameters) => Promise<void>;
  // (undocumented)
  updateRegistration?: (params: ServiceWorker.UpdateRegistrationParameters) => Promise<void>;
  // (undocumented)
  workerErrorReported: ServiceWorker.WorkerErrorReportedHandler | null;
  // (undocumented)
  workerRegistrationUpdated: ServiceWorker.WorkerRegistrationUpdatedHandler | null;
  // (undocumented)
  workerVersionUpdated: ServiceWorker.WorkerVersionUpdatedHandler | null;
}

// @public
interface NavigateResult extends PageNavigateResult {
  // (undocumented)
  body: Network.GetResponseBodyReturn;
}

// @public
interface PageNavigateResult {
  // (undocumented)
  frame: Page.Frame;
  // (undocumented)
  networkResult: Network.ResponseReceivedParameters;
}

// @public
class ServiceWorkerState {
  constructor(serviceWorker: IServiceWorker, log?: boolean);
  // (undocumented)
  getActive(): ServiceWorker.ServiceWorkerVersion;
  // (undocumented)
  getLastInstalled(): ServiceWorker.ServiceWorkerVersion;
  // (undocumented)
  skipWaiting(): Promise<void>;
  // (undocumented)
  waitForActivated(version?: string): Promise<ServiceWorker.ServiceWorkerVersion>;
  // (undocumented)
  waitForInstalled(version?: string): Promise<ServiceWorker.ServiceWorkerVersion>;
}

// @public
class TestEnvironment<S extends TestServerApi = TestServerApi> {
  // (undocumented)
  static build<S extends TestServerApi = TestServerApi>(client: IAPIClient, session: ISession, testServer: S): Promise<TestEnvironment<S>>;
  // (undocumented)
  getActiveTabClient(): ClientEnvironment;
  // (undocumented)
  getTestServer(): S;
  // (undocumented)
  newTab(): Promise<ClientEnvironment>;
  // (undocumented)
  openAndActivateTab(): Promise<ClientEnvironment>;
  // (undocumented)
  openLastTab(): Promise<void>;
  // (undocumented)
  openTabById(id: string): Promise<void>;
  // (undocumented)
  openTabByIndex(index: number): Promise<void>;
}

// @public
interface TestServerApi {
  // (undocumented)
  close: () => void;
  // (undocumented)
  reset: () => Promise<void>;
  // (undocumented)
  rootUrl: string;
}

// @public
class TestSession<S extends TestServerApi = TestServerApi> {
  constructor(testServerPromise: Promise<S>);
  // (undocumented)
  close(): Promise<void>;
  // (undocumented)
  ready(): Promise<void>;
  // (undocumented)
  run(test: (appEnv: TestEnvironment<S>) => Promise<void>): Promise<void>;
  // (undocumented)
  testServerPromise: Promise<S>;
}

// (No @packagedocumentation comment for this package)
