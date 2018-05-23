[Home](./index) &gt; [swae](./swae.md) &gt; [ApplicationEnvironment](./swae.applicationenvironment.md)

# ApplicationEnvironment class

API for interacting with the complete running test application

## Methods

|  Method | Access Modifier | Returns | Description |
|  --- | --- | --- | --- |
|  [`build(client, session, testServer)`](./swae.applicationenvironment.build.md) |  | `Promise<ApplicationEnvironment<S>>` |  |
|  [`getActiveTabClient()`](./swae.applicationenvironment.getactivetabclient.md) |  | `ClientEnvironment` |  |
|  [`getTestServer()`](./swae.applicationenvironment.gettestserver.md) |  | `S` |  |
|  [`newTab()`](./swae.applicationenvironment.newtab.md) |  | `Promise<ClientEnvironment>` |  |
|  [`openAndActivateTab()`](./swae.applicationenvironment.openandactivatetab.md) |  | `Promise<ClientEnvironment>` |  |
|  [`openLastTab()`](./swae.applicationenvironment.openlasttab.md) |  | `Promise<void>` |  |
|  [`openTabById(id)`](./swae.applicationenvironment.opentabbyid.md) |  | `Promise<void>` |  |
|  [`openTabByIndex(index)`](./swae.applicationenvironment.opentabbyindex.md) |  | `Promise<void>` |  |

## Remarks

This is the main point of interaction between test code and swae
