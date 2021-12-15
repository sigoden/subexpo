import { useRequest } from "ahooks";
import { formatNum } from "../lib/utils";

export default function Balance({ balance }) {
  const { data } = useRequest(
    { url: "/api/tokeninfo" },
    { cacheKey: "tokenInfo" }
  );
  if (data) {
    const tokenDecimals = parseInt(data.tokenDecimals[0]);
    let newBalance;
    if (balance === "0") {
      newBalance = "0";
    } else if (balance.length > tokenDecimals) {
      newBalance = formatNum(balance.slice(0, balance.length - tokenDecimals));
      let decimal = balance.slice(-1 * tokenDecimals).replace(/0\d+$/, "");
      if (decimal.length > 0) newBalance += "." + decimal;
    } else {
      newBalance =
        "0." + ("0".repeat(tokenDecimals) + balance).slice(-1 * tokenDecimals);
    }
    return (
      <div>
        {newBalance} {data.tokenSymbol[0]}
      </div>
    );
  } else {
    return <div>{balance}</div>;
  }
}
