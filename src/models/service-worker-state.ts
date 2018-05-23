import {
  ServiceWorker
} from 'chrome-debugging-client/dist/protocol/tot';

interface StateIdentifier {
  version?: string;
  state: ServiceWorker.ServiceWorkerVersionStatus;
}

type SerializedStateIdentifier = string;

function identifierFromVersion(v: ServiceWorker.ServiceWorkerVersion): StateIdentifier {
  return {
    version: v.versionId,
    state: v.status
  };
}

function serializeStateIdentifier({ version, state }: StateIdentifier): SerializedStateIdentifier {
  const sanitizedVersion = version ? version : '';
  const id = `${sanitizedVersion}:${state}`;
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
  get(key: StateIdentifier) {
    return super.get(serializeStateIdentifier(key));
  }
  set(key: StateIdentifier, value: V) {
    return super.set(serializeStateIdentifier(key), value);
  }
}

class StateIdArrayMap<V> extends Map<any, V[]> {
  get(key: StateIdentifier) {
    const versionQuery = super.get(serializeStateIdentifier(key));
    const eventQuery = super.get(serializeStateIdentifier({
      state: key.state
    }));
    if (!versionQuery && !eventQuery) {
      return;
    }
    return (versionQuery || []).concat(eventQuery || []);
  }
  set(key: StateIdentifier, value: V[]) {
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

/**
 * Models the state of Service Workers for a particular client
 * @remarks
 * Effectively a wrapper around the {@link https://chromedevtools.github.io/devtools-protocol/tot/ServiceWorker
 * | ServiceWorker} domain of the Chrome DevTools Protocol.
 * @public
 */
export class ServiceWorkerState {
  private versions: Map<number, ServiceWorker.ServiceWorkerVersion>;
  private active: ServiceWorker.ServiceWorkerVersion;
  private lastInstalled: ServiceWorker.ServiceWorkerVersion;

  private serviceWorker: IServiceWorker;

  private log: boolean;

  private stateListeners: StateIdArrayMap<VersionListener>;
  private stateHistory: StateIdMap<ServiceWorker.ServiceWorkerVersion>;

  constructor(serviceWorker: IServiceWorker, log = false) {
    this.versions = new Map();
    this.stateListeners = new StateIdArrayMap();
    this.stateHistory = new StateIdMap();
    this.log = log;
    serviceWorker.workerVersionUpdated = ({ versions }) => {
      for (let version of versions) {
        this.recordVersion(version);
      }
    };

    serviceWorker.workerErrorReported = (err) => {
      console.error('Service worker error:', err.errorMessage);
    };

    this.serviceWorker = serviceWorker;
  }
  private listen(id: StateIdentifier, listener: VersionListener) {
    let listeners = this.stateListeners.get(id);
    if (!listeners) {
      listeners = [];
      this.stateListeners.set(id, listeners);
    }
    listeners.push(listener);
  }
  private recordVersion(version: ServiceWorker.ServiceWorkerVersion) {
    if (this.log) {
      console.log('Service Worker Version', version);
    }
    this.versions.set(Number(version.versionId), version);
    const id = identifierFromVersion(version);
    this.stateHistory.set(id, version);
    const listeners = this.stateListeners.get(id);
    if (listeners) {
      listeners.forEach((listener) => {
        listener(version);
      });
    }

    if (version.status === 'activated') {
      this.handleActivated(version);
    } else if (version.status === 'installed') {
      this.handleInstalled(version);
    }
  }

  public waitForInstalled(version?: string) {
    if (!version && this.lastInstalled) {
      return Promise.resolve(this.lastInstalled);
    }
    return this.waitForState('installed', version);
  }

  public waitForActivated(version?: string) {
    if (!version && this.active) {
      return Promise.resolve(this.active);
    }
    return this.waitForState('activated', version);
  }

  // Potentially tricky behavior: If you specify a version in addition to a state, will resolve if event
  // happened in the past. If you only provide a state, will NOT resolve if event happened in past
  // TODO: Add tests for above ^^
  private waitForState(
    state: ServiceWorker.ServiceWorkerVersionStatus,
    version?: string
  ): Promise<ServiceWorker.ServiceWorkerVersion> {
    const existingHistory = this.stateHistory.get({ version, state });
    if (existingHistory) {
      return Promise.resolve(existingHistory);
    }
    return addTimeout(new Promise((resolve) => {
      this.listen({
        version,
        state
      }, (result) => {
        // Wait until the next tick so that any state changes take effect first
        Promise.resolve().then(() => {
          resolve(result);
        });
      });
    }), `Waiting for service worker version ${version} to be ${state} timed out`);
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
}