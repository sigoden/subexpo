import { createApi } from "../../lib/api";

export default async function handler(req, res) {
  const api = await createApi();
  const props = await api.registry.getChainProperties();
  res.json(props.toHuman());
}