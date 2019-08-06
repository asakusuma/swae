import { expect } from 'chai';
import { TestSession, mountRamDisk } from './../../src';
import { createServer } from './../server/';
import {
  wait
} from './utils';

const session = new TestSession(createServer(), { browserOptions: { browserType: 'canary' }});
before(session.ready.bind(session));
after(session.close.bind(session));

describe('Service Worker', () => {
  it('should have a version', async () => {
    await session.run(async (testEnv) => {
      const client = await testEnv.createTarget();
      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      const active = await client.swState.waitForActivated();
      expect(active.versionId).to.equal('0');
    });
  });

  it('should intercept basepage request and add meta tag', async () => {
    await session.run(async (testEnv) => {
      const client = await testEnv.createTarget();
      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client.swState.waitForActivated();

      const { page } = await client.load();

      expect(page.responseMeta.fromServiceWorker).to.be.true;
      expect(page.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });

  it('should intercept basepage request for tabs that were created before the worker was registered', async () => {
    await session.run(async (testEnv) => {
      const client1 = await testEnv.createTarget();
      await client1.load();

      const client2 = await testEnv.createAndActivateTab();

      await client2.load();
      await client2.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      const sw = await client2.swState.waitForActivated();

      // TODO: Figure out why test sometimes fails without this wait
      await wait(500);
      const controlledClients = sw.controlledClients ? sw.controlledClients.length : 0;
      expect(controlledClients).to.equal(2);

      const { page } = await client2.load();

      expect(
        page.responseMeta.fromServiceWorker,
        '2nd tab with registered service worker should intercept requests').to.be.true;
      expect(
        page.body.indexOf('from-service-worker') > 0,
        '2nd tab with registered service worker should add meta tag').to.be.true;

      // Go back to the first tab
      await testEnv.activateTabByIndex(0);

      const { page: page2 } = await client1.load();
      expect(page2.responseMeta.fromServiceWorker).to.be.true;
      expect(page2.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });

  it('should throw on service worker error by default', async () => {
    const shouldReject = async () => {
      await session.run(async (testEnv) => {
        const client = await testEnv.createTarget();
        await client.navigate();

        await client.evaluate(function() {
          return navigator.serviceWorker.register('/sw.js');
        });

        await client.swState.waitForActivated();

        await client.evaluate(function() {
          return navigator.serviceWorker.getRegistration().then((sw) => {
            if (sw && sw.active) {
              sw.active.postMessage({
                request: 'throwError'
              });
            }
          });
        });

        await wait(1000);
      });
    };
    return shouldReject().then(() => {
      throw new Error('Promise should not resolve');
    }, (err) => {
      expect(err.message).to.match(/Postmessage Test Error/);
    });
  });

  it('should not throw on service worker error if error is caught', async () => {
    await session.run(async (testEnv) => {
      const client = await testEnv.createTarget();

      // Catch errors and don't re-throw
      client.swState.catchErrors(() => {});

      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client.swState.waitForActivated();

      await client.evaluate(function() {
        return navigator.serviceWorker.getRegistration().then((sw) => {
          if (sw && sw.active) {
            sw.active.postMessage({
              request: 'throwError'
            });
          }
        });
      });

      await wait(1000);
    });
  });

  it('active version should only change after skipWaiting', async () => {
    await session.run(async (testEnv) => {
      const client = await testEnv.createTarget();

      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
      });

      await client.swState.waitForActivated();

      await testEnv.getTestServer().incrementVersion();

      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
      });

      await client.waitForServiceWorkerRegistration();

      await client.swState.waitForInstalled('1');

      const swState2 = await client.swState.getActive();
      expect(swState2.versionId).to.equal('0', 'Should be at version 0 even after 1 installs');

      await client.swState.skipWaiting();

      await client.swState.waitForActivated('1');

      const swState3 = await client.swState.getActive();
      expect(swState3.versionId).to.equal('1', 'Should be at version 1 after skipWaiting');
    });
  });

  it('should throw QuotaExceededError when attempting to write to full storage', async () => {
    const diskHandle = await mountRamDisk(512000);
    try {
      try {
        await session.run(async (testEnv) => {
          const client = await testEnv.createTarget();

          await client.navigate();

          await client.evaluate(function() {
            return navigator.serviceWorker.register('/sw.js');
          });
          // await client.ensureMaximumStorageAvailable(1000);
          await client.swState.waitForActivated();

          await client.evaluate(function() {
            return navigator.serviceWorker.getRegistration().then((sw) => {
              if (sw && sw.active) {
                sw.active.postMessage({
                  request: 'cacheTest'
                });
              }
            });
          });

          // TODO: wait on actual cache operation
          await wait(1000);
        }, {
          userDataRoot: diskHandle.mountPath
        });
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).to.match(/Quota/, 'Should throw Quota error');
        } else {
          throw new Error('Expected caught error');
        }
      }
    } finally {
      await diskHandle.eject();
    }
  });
});