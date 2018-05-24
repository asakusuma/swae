import { expect } from 'chai';
import { TestSession } from './../../src';
import { createServer } from './../server/';

const session = new TestSession(createServer());
before(session.ready.bind(session));
after(session.close.bind(session));

describe('Service Worker', () => {
  it('should have a version', async () => {
    await session.run(async (testEnv) => {
      const client = testEnv.getActiveTabClient();
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
      const client = testEnv.getActiveTabClient();
      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client.swState.waitForActivated();

      const { body, networkResult } = await client.navigate();

      expect(networkResult.response.fromServiceWorker).to.be.true;
      expect(body.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });

  it('should intercept basepage request for tabs that were created before the worker was registered', async () => {
    await session.run(async (testEnv) => {
      const client1 = testEnv.getActiveTabClient();
      await client1.navigate();

      const client2 = await testEnv.openAndActivateTab();

      await client2.navigate();

      await client2.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      const sw = await client2.swState.waitForActivated();

      const controlledClients = sw.controlledClients ? sw.controlledClients.length : 0;
      expect(controlledClients).to.equal(2);

      const navResult = await client2.navigate();

      expect(
        navResult.networkResult.response.fromServiceWorker,
        '2nd tab with registered service worker should intercept requests').to.be.true;
      expect(
        navResult.body.body.indexOf('from-service-worker') > 0,
        '2nd tab with registered service worker should add meta tag').to.be.true;

      // Go back to the first tab
      await testEnv.openTabByIndex(0);

      const navResult2 = await client1.navigate();

      expect(navResult2.networkResult.response.fromServiceWorker).to.be.true;
      expect(navResult2.body.body.indexOf('from-service-worker') > 0).to.be.true;
    });
  });

  it('active version should only change after skipWaiting', async () => {
    await session.run(async (testEnv) => {
      const client = testEnv.getActiveTabClient();
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
});