import "antd/dist/antd.css";
import { useRequest } from "@umijs/hooks";
import "../global.css";

export default function MyApp({ Component, pageProps }) {
  useRequest({ url: "/api/tokeninfo" }, { cacheKey: "tokenInfo" });
  const getLayout = Component.getLayout || ((page) => page);
  return getLayout(<Component {...pageProps} />);
}
