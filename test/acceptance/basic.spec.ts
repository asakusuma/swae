import { expect } from 'chai';
import { TestSession } from './../../src';
import { createServer } from './../server/';
const { performance } = require('perf_hooks');

export function wait(time: number) {
  return new Promise((r) => {
    setTimeout(r, time);
  });
}

const session = new TestSession(createServer(), { browserOptions: { browserType: 'canary' }});
before(session.ready.bind(session));
after(session.close.bind(session));

const runs = 100;

describe('Service Worker', () => {
  let noWaitTotal = 0;
  let waitTotal = 0;
  after(() => {
    const avgWait = waitTotal / runs;
    const avgNoWait = noWaitTotal / runs;
    console.log('Avg wait: ', avgWait);
    console.log('Avg no wait: ', avgNoWait);
  });

  for (let i = 0; i < runs; i++) {
    it('with wait', async () => {
      await session.run(async (testEnv) => {
        const client = await testEnv.createTarget();
        const t0 = performance.now();
        await client.navigate({
          waitForLoad: true
        });
        waitTotal += performance.now() - t0;

        await client.evaluate(function() {
          return navigator.serviceWorker.register('/sw.js');
        });

        const active = await client.swState.waitForActivated();
        expect(active.versionId).to.equal('0');
      });
    });
  }

  for (let i = 0; i < runs; i++) {
    it('without wait', async () => {
      await session.run(async (testEnv) => {
        const client = await testEnv.createTarget();
        const t0 = performance.now();
        await client.navigate();
        noWaitTotal += performance.now() - t0;

        await client.evaluate(function() {
          return navigator.serviceWorker.register('/sw.js');
        });

        const active = await client.swState.waitForActivated();
        expect(active.versionId).to.equal('0');
      });
    });
  }
});