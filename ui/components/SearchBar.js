import { useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import { Input } from "antd";
import { useRequest } from "@umijs/hooks";
const { Search } = Input;

import styles from "./SearchBar.module.css";

async function search(q) {
  return fetch(`/api/search?q=${q}`).then(res => res.json());
}

export default function SearchBar() {
  const router = useRouter();
  const { data, run, params } =  useRequest(search, { manual: true })
  useEffect(() => {
    if (!data) return; 
    const { kind } = data;
    if (kind === "block") {
      router.push("/blocks/" + params[0]);
    } else if (kind === "extrinsic") {
      router.push("/extrinsics/" + params[0]);
    }
  }, [data, params, router]);
  return (
    <div className={styles.wrapSearch}>
      <Search
        className={styles.search}
        placeholder="Search by Block / Extrinsic / Account"
        enterButton="Search"
        size="large"
        onSearch={run}
      />
    </div>
  );
}