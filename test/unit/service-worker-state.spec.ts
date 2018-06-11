/*
import { expect } from 'chai';
import { ServiceWorkerState, IServiceWorker } from './../../src';
import {
  ServiceWorker
} from 'chrome-debugging-client/dist/protocol/tot';
import { ISession, IDebuggingProtocolClient } from 'chrome-debugging-client';

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
      const state = new ServiceWorkerState(mockSession, mockClient, sw);
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

    it('should wait for activation event when passed a version after the event happens', async () => {
      const sw = new TestServiceWorker();
      const state = new ServiceWorkerState(sw);
      sw.workerVersionUpdated({
        versions: [{
          versionId: '1',
          registrationId: '0',
          scriptURL: '',
          runningStatus: 'running',
          status: 'activated'
        }]
      });

      const version = await state.waitForActivated('1');
      expect(version.versionId).to.equal('1');
    });

    it('should wait for activation event when passed a version before the event happens', async () => {
      const sw = new TestServiceWorker();
      const state = new ServiceWorkerState(sw);
      const activatedPromise = state.waitForActivated('1');
      sw.workerVersionUpdated({
        versions: [{
          versionId: '1',
          registrationId: '0',
          scriptURL: '',
          runningStatus: 'running',
          status: 'activated'
        }]
      });

      const version = await activatedPromise;
      expect(version.versionId).to.equal('1');
    });

    it('should wait for retroactive activation event with multiple listeners', async () => {
      const sw = new TestServiceWorker();
      const state = new ServiceWorkerState(sw);
      sw.workerVersionUpdated({
        versions: [{
          versionId: '1',
          registrationId: '0',
          scriptURL: '',
          runningStatus: 'running',
          status: 'activated'
        }]
      });

      const version = await state.waitForActivated('1');
      const version1 = await state.waitForActivated('1');
      expect(version.versionId).to.equal('1');
      expect(version1.versionId).to.equal('1');
    });

    it('should wait for activation event with multiple listeners', async () => {
      const sw = new TestServiceWorker();
      const state = new ServiceWorkerState(sw);
      const activatedPromise = state.waitForActivated('1');
      const activatedPromise2 = state.waitForActivated('1');
      sw.workerVersionUpdated({
        versions: [{
          versionId: '1',
          registrationId: '0',
          scriptURL: '',
          runningStatus: 'running',
          status: 'activated'
        }]
      });

      const version = await activatedPromise;
      const version2 = await activatedPromise2;
      expect(version.versionId).to.equal('1');
      expect(version2.versionId).to.equal('1');
    });
  });
});
*/