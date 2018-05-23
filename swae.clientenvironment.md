[Home](./index) &gt; [swae](./swae.md) &gt; [ClientEnvironment](./swae.clientenvironment.md)

# ClientEnvironment class

Models a particular client, usually a Chrome tab

## Properties

|  Property | Access Modifier | Type | Description |
|  --- | --- | --- | --- |
|  [`cacheStorage`](./swae.clientenvironment.cachestorage.md) |  | `CacheStorage` |  |
|  [`indexedDB`](./swae.clientenvironment.indexeddb.md) |  | `IndexedDB` |  |
|  [`network`](./swae.clientenvironment.network.md) |  | `Network` |  |
|  [`page`](./swae.clientenvironment.page.md) |  | `Page` |  |
|  [`rootUrl`](./swae.clientenvironment.rooturl.md) |  | `string` |  |
|  [`serviceWorker`](./swae.clientenvironment.serviceworker.md) |  | `ServiceWorker` |  |
|  [`swState`](./swae.clientenvironment.swstate.md) |  | `ServiceWorkerState` |  |

## Methods

|  Method | Access Modifier | Returns | Description |
|  --- | --- | --- | --- |
|  [`build(debuggerClient, rootUrl)`](./swae.clientenvironment.build.md) |  | `Promise<ClientEnvironment>` |  |
|  [`close()`](./swae.clientenvironment.close.md) |  | `Promise<void>` |  |
|  [`evaluate(toEvaluate)`](./swae.clientenvironment.evaluate.md) |  | `Promise<T>` |  |
|  [`navigate(targetUrl)`](./swae.clientenvironment.navigate.md) |  | `Promise<NavigateResult>` |  |
|  [`waitForServiceWorkerRegistration()`](./swae.clientenvironment.waitforserviceworkerregistration.md) |  | `Promise<Promise<ServiceWorkerRegistration | undefined>>` |  |

