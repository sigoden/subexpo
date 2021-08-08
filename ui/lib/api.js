const { ApiPromise, WsProvider } = require("@polkadot/api");
const types = require("../../types.json");

/**
 * @type ApiPromise
 */
let api;

/**
 * @returns {ApiPromise}
 */
export async function createApi() {
  if (global.api) return global.api
  if (api) return api;
  const provider = new WsProvider(process.env.ENDPOINT);
  api = global.api = await ApiPromise.create({ provider, types })
  await api.isReady;
  return api;
}
