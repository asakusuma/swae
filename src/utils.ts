import {
  Network
} from 'chrome-debugging-client/dist/protocol/tot';


export async function emulateOffline(network: Network) {
  await network.emulateNetworkConditions({
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
}

export async function turnOffEmulateOffline(network: Network) {
  await network.emulateNetworkConditions({
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
}