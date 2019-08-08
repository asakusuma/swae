import { expect } from 'chai';
import { runMockScenario } from './utils';

describe('Service Worker State', () => {
  describe('waitForActivated', () => {
    it('should wait for activation event', async () => {
      await runMockScenario(async (state, page) => {
        const activatedPromise = state.waitForActivated();
        page.trigger('ServiceWorker.workerVersionUpdated', {
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

    it('should wait for activation event when passed a version after the event happens', async () => {
      await runMockScenario(async (state, page) => {
        page.trigger('ServiceWorker.workerVersionUpdated', {
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
    });

    it('should wait for activation event when passed a version before the event happens', async () => {
      await runMockScenario(async (state, page) => {
        const activatedPromise = state.waitForActivated('1');
        page.trigger('ServiceWorker.workerVersionUpdated', {
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
    });

    it('should wait for retroactive activation event with multiple listeners', async () => {
      await runMockScenario(async (state, page) => {
        page.trigger('ServiceWorker.workerVersionUpdated', {
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
    });

    it('should wait for activation event with multiple listeners', async () => {
      await runMockScenario(async (state, page) => {
        const activatedPromise = state.waitForActivated('1');
        const activatedPromise2 = state.waitForActivated('1');
        page.trigger('ServiceWorker.workerVersionUpdated', {
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
});