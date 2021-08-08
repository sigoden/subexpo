import { useCallback } from "react";
import { useRouter } from "next/router";
import { Input, message } from "antd";
const { Search } = Input;

import styles from "./SearchBar.module.css";

export default function SearchBar() {
  const router = useRouter();
  const onSearch = useCallback(async q => {
      const data = await fetch(`/api/search?q=${q}`).then(res => res.json());
      const { kind, value } = data;
      if (kind === "block") {
        router.push("/blocks/" + value);
      } else if (kind === "extrinsic") {
        router.push("/extrinsics/" +value);
      } else {
        message.error("Not found");
      }
  }, [router]);
  return (
    <div className={styles.wrapSearch}>
      <Search
        className={styles.search}
        placeholder="Search by Block / Extrinsic / Account"
        enterButton="Search"
        size="large"
        onSearch={onSearch}
      />
    </div>
  );
}