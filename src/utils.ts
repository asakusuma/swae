import { Network } from 'chrome-debugging-client/dist/protocol/tot';

export interface HasNetwork {
  network: Network;
}

export async function emulateOffline(hasNetwork: HasNetwork) {
  await hasNetwork.network.emulateNetworkConditions({
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
}

export async function turnOffEmulateOffline(hasNetwork: HasNetwork) {
  await hasNetwork.network.emulateNetworkConditions({
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
}