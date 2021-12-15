import React from "react";
import { Layout, Grid } from "antd";
import dynamic from "next/dynamic";
import Link from "next/link";
import SearchBar from "./SearchBar";
import styles from "./MainLayout.module.css";

const { Header, Content } = Layout;

const Navs = dynamic(() => import("./Navs"), { ssr: false });

export default function MainLayout({ children, noSearch }) {
  const { xs } = Grid.useBreakpoint();
  return (
    <Layout>
      <Header className={xs ? styles.wrapHeaderXs : styles.wrapHeader}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Link href="/">SUBEXPO</Link>
          </div>
          <Navs />
        </div>
      </Header>
      <Content className={styles.wrapContent}>
        {noSearch ? <div /> : <SearchBar />}
        {children}
      </Content>
    </Layout>
  );
}
