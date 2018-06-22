import {
  ServiceWorker, Network
} from 'chrome-debugging-client/dist/protocol/tot';
import { ISession, IDebuggingProtocolClient } from 'chrome-debugging-client';

export interface VersionStatusIdentifier {
  status: ServiceWorker.ServiceWorkerVersionStatus;
  version?: string;
  runningStatus?: ServiceWorker.ServiceWorkerVersionRunningStatus;
}

type SerializedStateIdentifier = string;

function identifierFromVersion(v: ServiceWorker.ServiceWorkerVersion): VersionStatusIdentifier {
  return {
    version: v.versionId,
    status: v.status,
    runningStatus: v.runningStatus
  };
}

function serializeStateIdentifier({ version, status, runningStatus }:
  VersionStatusIdentifier): SerializedStateIdentifier {
  const sanitizedVersion = version ? version : '';
  const sanitizedRunningStatus = runningStatus ? runningStatus : '';
  const id = `${sanitizedVersion}:${status}:${sanitizedRunningStatus}`;
  return id;
}

function addTimeout<T>(promise: Promise<T>, msg: string, timeout: number = 6000): Promise<T> {
  const timedOut: Promise<T> = new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(msg));
    }, timeout);
  });
  return Promise.race([promise, timedOut]);
}

class StateIdMap<V> extends Map<any, V> {
  get(key: VersionStatusIdentifier) {
    return super.get(serializeStateIdentifier(key));
  }
  set(key: VersionStatusIdentifier, value: V) {
    return super.set(serializeStateIdentifier(key), value);
  }
}

class StateIdArrayMap<V> extends Map<any, V[]> {
  get(key: VersionStatusIdentifier) {
    const versionQuery = super.get(serializeStateIdentifier(key));
    const eventQuery = super.get(serializeStateIdentifier({
      status: key.status,
      runningStatus: key.runningStatus
    }));
    if (!versionQuery && !eventQuery) {
      return;
    }
    return (versionQuery || []).concat(eventQuery || []);
  }
  set(key: VersionStatusIdentifier, value: V[]) {
    return super.set(serializeStateIdentifier(key), value);
  }
}

/**
 * Interface for ServiceWorker class, generated by chrome-debugging-client, that represents
 * the raw API for the ServiceWorker DevTools protocl domain
 * @public
 */
export interface IServiceWorker {
  skipWaiting: (params: ServiceWorker.SkipWaitingParameters) => Promise<void>;

  workerErrorReported: ServiceWorker.WorkerErrorReportedHandler | null;
  workerRegistrationUpdated: ServiceWorker.WorkerRegistrationUpdatedHandler | null;
  workerVersionUpdated: ServiceWorker.WorkerVersionUpdatedHandler | null;

  // Set all the other methods as optional until we actually start using them
  deliverPushMessage?: (params: ServiceWorker.DeliverPushMessageParameters) => Promise<void>;
  disable?: () => Promise<void>;
  dispatchSyncEvent?: (params: ServiceWorker.DispatchSyncEventParameters) => Promise<void>;
  enable?: () => Promise<void>;
  inspectWorker?: (params: ServiceWorker.InspectWorkerParameters) => Promise<void>;
  setForceUpdateOnPageLoad?: (params: ServiceWorker.SetForceUpdateOnPageLoadParameters) => Promise<void>;
  startWorker?: (params: ServiceWorker.StartWorkerParameters) => Promise<void>;
  stopAllWorkers?: () => Promise<void>;
  stopWorker?: (params: ServiceWorker.StopWorkerParameters) => Promise<void>;
  unregister?: (params: ServiceWorker.UnregisterParameters) => Promise<void>;
  updateRegistration?: (params: ServiceWorker.UpdateRegistrationParameters) => Promise<void>;
}

type VersionListener = (v: ServiceWorker.ServiceWorkerVersion) => void;

interface ServiceWorkerCore {
  client: IDebuggingProtocolClient;
  networkDomain: Network;
}

class ServiceWorkerProtocolSession {
  private core: Promise<ServiceWorkerCore>;
  constructor(public targetId: string, clientP: Promise<IDebuggingProtocolClient>) {
    this.core = clientP.then(async (client) => {
      const networkDomain = new Network(client);
      await networkDomain.enable({});
      return {
        client,
        networkDomain
      };
    });
  }
  public async emulateOffline(offline: boolean) {
    await this.core;
    throw new Error('Offline emulation not working. See https://bugs.chromium.org/p/chromium/issues/detail?id=852127');
    /*
    const { networkDomain } = await this.core;
    if (offline) {
      console.log('sw emulate', this.targetId);
      await emulateOffline(networkDomain);
    } else {
      await turnOffEmulateOffline(networkDomain);
    }
    */
  }
}

/**
 * ServiceWorkerState config options
 * @internal
 */
export interface IServiceWorkerStateOptions {
  log?: boolean;
}

export type ServiceWorkerErrorCallback = (err: ServiceWorker.ServiceWorkerErrorMessage) => void;

/**
 * Models the state of Service Workers for a particular client
 * @remarks
 * Effectively a wrapper around the {@link https://chromedevtools.github.io/devtools-protocol/tot/ServiceWorker
 * | ServiceWorker} domain of the Chrome DevTools Protocol.
 * @internal
 */
export class ServiceWorkerState {
  private versions: Map<number, ServiceWorker.ServiceWorkerVersion>;
  private active: ServiceWorker.ServiceWorkerVersion;
  private lastInstalled: ServiceWorker.ServiceWorkerVersion;

  private serviceWorker: IServiceWorker;

  private log: boolean;
  private errors: ServiceWorker.ServiceWorkerErrorMessage[];

  private stateListeners: StateIdArrayMap<VersionListener>;
  private stateHistory: StateIdMap<ServiceWorker.ServiceWorkerVersion>;

  private targets: Map<string, ServiceWorkerProtocolSession>;
  private session: ISession;
  private browserClient: IDebuggingProtocolClient;

  private errorCallbacks: ServiceWorkerErrorCallback[];

  constructor(
    session: ISession,
    browserClient: IDebuggingProtocolClient,
    serviceWorker: IServiceWorker,
    options: IServiceWorkerStateOptions = {}
  ) {
    this.versions = new Map();
    this.stateListeners = new StateIdArrayMap();
    this.stateHistory = new StateIdMap();
    this.log = !!options.log;

    this.targets = new Map();
    this.session = session;
    this.browserClient = browserClient;

    this.errorCallbacks = [];

    this.errors = [];

    // TODO: Somehow add ability to listen to network requests from the service worker
    // The service worker might be its own client

    serviceWorker.workerVersionUpdated = ({ versions }) => {
      for (let version of versions) {
        this.recordVersion(version);
      }
    };

    serviceWorker.workerErrorReported = ({ errorMessage }) => {
      this.errors.push(errorMessage);
    };

    this.serviceWorker = serviceWorker;
  }
  public catchErrors(cb: ServiceWorkerErrorCallback) {
    this.errorCallbacks.push(cb);
  }
  public getErrors() {
    return this.errors;
  }
  public ensureNoErrors() {
    const errors = this.errors;
    this.errors = [];
    const cbs = this.errorCallbacks.length;
    if (errors.length) {
      // If we are handling the errors via registered callbacks, delegate
      if (cbs > 0) {
        for (let i = 0; i < errors.length; i++) {
          for (let x = 0; x < cbs; x++) {
            this.errorCallbacks[x](errors[i]);
          }
        }
      } else {
        // Otherwise throw and log

        // TODO: Better surface all the errors
        throw new Error(`Uncaught error thrown in Service Worker: ${errors[0].errorMessage}`);
      }
    }
  }
  private listen(id: VersionStatusIdentifier, listener: VersionListener) {
    let listeners = this.stateListeners.get(id) || [];
    listeners.push(listener);
    this.stateListeners.set(id, listeners);
  }
  private recordVersion(version: ServiceWorker.ServiceWorkerVersion) {
    if (this.log) {
      console.log('[sw]', version.status, version.runningStatus, version.versionId);
    }
    this.versions.set(Number(version.versionId), version);
    const id = identifierFromVersion(version);
    this.stateHistory.set(id, version);

    if (version.targetId && !this.targets.has(version.targetId)) {
      const attach = this.session.attachToTarget(this.browserClient, version.targetId);
      this.targets.set(version.targetId, new ServiceWorkerProtocolSession(version.targetId, attach));
    }

    if (version.status === 'activated' && version.runningStatus === 'running') {
      this.handleActivated(version);
    } else if (version.status === 'installed' && version.runningStatus === 'running') {
      this.handleInstalled(version);
    }

    const listeners = this.stateListeners.get(id);
    if (listeners) {
      listeners.forEach((listener) => {
        listener(version);
      });
    }
  }

  public debug() {
    this.log = true;
  }

  public waitForInstalled(version?: string) {
    if (!version && this.lastInstalled) {
      return Promise.resolve(this.lastInstalled);
    }
    return this.waitForState({
      status: 'installed',
      version
    });
  }

  public waitForActivated(version?: string) {
    if (!version && this.active) {
      return Promise.resolve(this.active);
    }
    return this.waitForState({
      status: 'activated',
      version
    });
  }

  public waitForActivation() {
    return this.waitForState('activated');
  }

  public waitForInstallation() {
    return this.waitForState('installed');
  }

  // Potentially tricky behavior: If you specify a version in addition to a state, will resolve if event
  // happened in the past. If you only provide a state, will NOT resolve if event happened in past
  // TODO: Add tests for above ^^
  // TODO: Need a more robust event listening engine now that we have 3 different properties on VersionStatusIdentifier
  public waitForState(arg: VersionStatusIdentifier | ServiceWorker.ServiceWorkerVersionStatus):
    Promise<ServiceWorker.ServiceWorkerVersion> {
    const id: VersionStatusIdentifier = typeof arg === 'string' ? { status: arg } : arg;
    if (!id.runningStatus) {
      id.runningStatus = 'running';
    }
    const existingHistory = this.stateHistory.get(id);
    if (existingHistory) {
      return Promise.resolve(existingHistory);
    }
    return addTimeout(new Promise((resolve) => {
      this.listen(id, (result) => {
        // Wait until the next tick so that any state changes take effect first
        Promise.resolve().then(() => {
          resolve(result);
        });
      });
    }), `Waiting for service worker version ${id.version} to be ${id.status} timed out`, 10000);
  }

  private handleActivated(version: ServiceWorker.ServiceWorkerVersion) {
    this.active = version;
  }

  private handleInstalled(version: ServiceWorker.ServiceWorkerVersion) {
    this.lastInstalled = version;
  }

  public getActive() {
    if (!this.active) {
      throw new Error('Error calling getActive(): There is no active worker yet. Try using waitForActivated()');
    }
    return this.active;
  }

  public getLastInstalled() {
    return this.lastInstalled;
  }

  public skipWaiting() {
    return this.serviceWorker.skipWaiting({
      scopeURL: '/'
    });
  }

  public emulateOffline(offline: boolean) {
    throw new Error('Offline emulation not working. See https://bugs.chromium.org/p/chromium/issues/detail?id=852127');
    /*
    return Promise.all(Array.from(this.targets).map(([key, sw]) => {
      return sw.emulateOffline(offline);
    }));
    */
  }

  public close() {
    // TODO: Once we move to using new BrowserContext per test, instead of an entire new ISession,
    // we need to manually close all the ServiceWorkerProtocolSessions
  }
}