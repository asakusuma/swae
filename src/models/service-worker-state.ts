import {
  ServiceWorker
} from 'chrome-debugging-client/dist/protocol/tot';

interface StateIdentifier {
  version: string;
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
  return `${version}:${state}`;
}

function addTimeout<T>(promise: Promise<T>, msg: string, timeout: number = 5000): Promise<T> {
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

type VersionListener = (v: ServiceWorker.ServiceWorkerVersion) => void;

export class ServiceWorkerState {
  private versions: Map<number, ServiceWorker.ServiceWorkerVersion>;
  private active: ServiceWorker.ServiceWorkerVersion;
  private lastInstalled: ServiceWorker.ServiceWorkerVersion;

  private serviceWorker: ServiceWorker;

  private log: boolean;

  private stateListeners: StateIdMap<(VersionListener)[]>;
  private stateHistory: StateIdMap<ServiceWorker.ServiceWorkerVersion>;

  constructor(serviceWorker: ServiceWorker, log = false) {
    this.versions = new Map();
    this.stateListeners = new StateIdMap();
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

  public waitForInstalled(version: string) {
    return this.waitForState(version, 'installed');
  }

  public waitForActivated(version: string) {
    return this.waitForState(version, 'activated');
  }

  private waitForState(
    version: string,
    state: ServiceWorker.ServiceWorkerVersionStatus
  ): Promise<ServiceWorker.ServiceWorkerVersion> {
    const existingHistory = this.stateHistory.get({ version, state });
    if (existingHistory) {
      return Promise.resolve(existingHistory);
    }
    return addTimeout(new Promise((resolve) => {
      this.listen({
        version,
        state
      }, resolve);
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