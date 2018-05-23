[Home](./index) &gt; [swae](./swae.md) &gt; [ServiceWorkerState](./swae.serviceworkerstate.md)

# ServiceWorkerState class

Models the state of Service Workers for a particular client

## Methods

|  Method | Access Modifier | Returns | Description |
|  --- | --- | --- | --- |
|  [`constructor(serviceWorker, log)`](./swae.serviceworkerstate.constructor.md) |  |  | Constructs a new instance of the [ServiceWorkerState](./swae.serviceworkerstate.md) class |
|  [`getActive()`](./swae.serviceworkerstate.getactive.md) |  | `ServiceWorker.ServiceWorkerVersion` |  |
|  [`getLastInstalled()`](./swae.serviceworkerstate.getlastinstalled.md) |  | `ServiceWorker.ServiceWorkerVersion` |  |
|  [`skipWaiting()`](./swae.serviceworkerstate.skipwaiting.md) |  | `Promise<void>` |  |
|  [`waitForActivated(version)`](./swae.serviceworkerstate.waitforactivated.md) |  | `Promise<ServiceWorker.ServiceWorkerVersion>` |  |
|  [`waitForInstalled(version)`](./swae.serviceworkerstate.waitforinstalled.md) |  | `Promise<ServiceWorker.ServiceWorkerVersion>` |  |

## Remarks

Effectively a wrapper around the [ServiceWorker](https://chromedevtools.github.io/devtools-protocol/tot/ServiceWorker) domain of the Chrome DevTools Protocol.
