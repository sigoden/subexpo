const { ApiPromise, WsProvider } = require("@polkadot/api");

/**
 * @returns {ApiPromise}
 */
export async function createApi() {
  if (global.api) return global.api;
  const provider = new WsProvider(process.env.ENDPOINT);
  let options = {};
  try {
    options = { ...require(process.env.TYPE_FILE || "../type") };
  } catch {}
  const api = (global.api = await ApiPromise.create({ provider, ...options }));
  await api.isReady;
  return api;
}
