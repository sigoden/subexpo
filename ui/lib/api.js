import { ApiPromise, WsProvider } from "@polkadot/api";

/**
 * @returns {ApiPromise}
 */
export async function createApi() {
  if (global.api) return global.api;
  const provider = new WsProvider(process.env.ENDPOINT);
  const api = (global.api = await ApiPromise.create({ provider }));
  await api.isReady;
  return api;
}
