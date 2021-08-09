import { useRequest } from "@umijs/hooks";
import { Spin } from "antd";
import { formatNum } from "../lib/utils";

export default function Balance({ balance }) {
  const {data, loading} = useRequest({ url: "/api/tokeninfo" }, { cacheKey: "tokenInfo" });
  if (loading) return <Spin />
  const tokenDecimals = parseInt(data.tokenDecimals[0]);
  let newBalance;
  if (balance === "0") {
    newBalance = "0";
  } else if (balance.length > tokenDecimals) {
    newBalance = formatNum(balance.slice(0, balance.length - tokenDecimals));
    let decimal = balance.slice(-1 * tokenDecimals).replace(/0\d+$/, "");
    if (decimal.length > 0)
    newBalance += "." + decimal;
  } else {
    newBalance = "0." + ("0".repeat(tokenDecimals) + balance).slice(-1 * tokenDecimals);
  }
  return <div>{newBalance}</div>
}