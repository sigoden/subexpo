import "antd/dist/antd.css";
import { useRequest } from "ahooks";
import "../global.css";
import { loadJson } from "../lib/utils";

export default function MyApp({ Component, pageProps }) {
  useRequest(() => loadJson("/api/tokeninfo"), { cacheKey: "tokenInfo" });
  const getLayout = Component.getLayout || ((page) => page);
  return getLayout(<Component {...pageProps} />);
}
