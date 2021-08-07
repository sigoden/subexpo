import { useEffect, useState } from "react";
import { formatTimeAgo } from "../lib/utils";

export default function TimeAgo({ time }) {
  const [value, setValue] = useState(formatTimeAgo(time * 1000))
  useEffect(() => {
    const passSecs = Date.now() / 1000 - time;
    let interval = 1000;
    if (passSecs > 60000) {
      interval = 30000;
    }
    const id = setInterval(() => setValue(formatTimeAgo(time * 1000)), interval)
    return () => clearInterval(id)
  }, [time])
  return (<div>{value}</div>)
}