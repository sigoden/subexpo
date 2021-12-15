const { ApiPromise, WsProvider } = require("@polkadot/api");

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
  let options = {};
  try {
    options = { ...require(process.env.TYPE_FILE || "../type") }
  } catch {}
  api = global.api = await ApiPromise.create({ provider, ...options })
  await api.isReady;
  return api;
}
