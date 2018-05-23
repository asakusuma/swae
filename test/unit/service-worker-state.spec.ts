import { expect } from 'chai';
import { ServiceWorkerState, IServiceWorker } from './../../src';
import {
  ServiceWorker
} from 'chrome-debugging-client/dist/protocol/tot';

class TestServiceWorker implements IServiceWorker {
  public workerErrorReported: ServiceWorker.WorkerErrorReportedHandler;
  public workerRegistrationUpdated: ServiceWorker.WorkerRegistrationUpdatedHandler;
  public workerVersionUpdated: ServiceWorker.WorkerVersionUpdatedHandler;

  skipWaiting() {
    return Promise.resolve();
  }
}

describe('Service Worker State', () => {
  describe('waitForActivated', () => {
    it('should wait for activation event', async () => {
      const sw = new TestServiceWorker();
      const state = new ServiceWorkerState(sw);
      const activatedPromise = state.waitForActivated();
      sw.workerVersionUpdated({
        versions: [{
          versionId: '0',
          registrationId: '0',
          scriptURL: '',
          runningStatus: 'running',
          status: 'activated'
        }]
      });

      const version = await activatedPromise;
      expect(version.versionId).to.equal('0');
    });
  });
});