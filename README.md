# swae [![Build Status](https://api.travis-ci.org/asakusuma/swae.svg?branch=master)](https://travis-ci.org/asakusuma/swae) [![npm version](https://badge.fury.io/js/swae.svg)](https://www.npmjs.com/package/swae)
**S**ervice**W**orker**A**ssessment**E**ngine

A service worker testing framework in the early stages of development. Effectively a big wrapper around [chrome-debugging-client](https://github.com/devtrace/chrome-debugging-client), which is node client for interacting with [Headless Chrome](https://developers.google.com/web/updates/2017/04/headless-chrome). Built with [TypeScript](https://www.typescriptlang.org/).

## Setup

Ensure your project sets the node `CHROME_BIN` environment varible. You can use a number of methods to set the variable, but [dotenv](https://github.com/motdotla/dotenv) is recommended.

## Example

```TypeScript
import { expect } from 'chai';
import { TestSession } from 'swae';
import { createServer } from './my-test-server';

const session = new TestSession(createServer());
before(session.ready.bind(session));
after(session.close.bind(session));

describe('Service Worker', () => {
  it('should respond to requests', async () => {
    await session.run(async (testEnv) => {
      const client = testEnv.getActiveTabClient();

      await client.navigate();

      await client.evaluate(function() {
        return navigator.serviceWorker.register('/sw.js');
      });

      await client.swState.waitForActivated();

      const { body, networkResult } = await client.navigate();

      expect(networkResult.response.fromServiceWorker).to.be.true;
    });
  });
});
```