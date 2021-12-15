import { useEffect, useState } from "react";
import { formatTimeAgo } from "../lib/utils";

export default function TimeAgo({ time }) {
  const [value, setValue] = useState(formatTimeAgo(time * 1000));
  useEffect(() => {
    const passSecs = Date.now() / 1000 - time;
    if (passSecs > 3600000) {
      return;
    }
    let interval = passSecs > 60000 ? 30000 : 1000;
    const id = setInterval(
      () => setValue(formatTimeAgo(time * 1000)),
      interval
    );
    return () => clearInterval(id);
  }, [time]);
  return <div>{value}</div>;
}
