import { ServiceWorkerState, IServiceWorker } from './../../src';
import {
  ServiceWorker
} from 'chrome-debugging-client/dist/protocol/tot';
import { createSession } from 'chrome-debugging-client';

class TestServiceWorker implements IServiceWorker {
  public workerErrorReported: ServiceWorker.WorkerErrorReportedHandler;
  public workerRegistrationUpdated: ServiceWorker.WorkerRegistrationUpdatedHandler;
  public workerVersionUpdated: ServiceWorker.WorkerVersionUpdatedHandler;

  skipWaiting() {
    return Promise.resolve();
  }
}

type Scenario = (state: ServiceWorkerState, sw: TestServiceWorker) => Promise<void>;

export async function runMockScenario(cb: Scenario) {
  await createSession(async (session) => {
    const sw = new TestServiceWorker();
    const browser = await session.spawnBrowser({
      additionalArguments: ['--headless'],
    });
    const browserClient = await session.openDebuggingProtocol(
      browser.webSocketDebuggerUrl!,
    );
    const state = new ServiceWorkerState(session, browserClient, sw);
    await cb(state, sw);
  });
}