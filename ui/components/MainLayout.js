import React from "react";
import { Layout, Menu, Grid } from "antd";
const { Header, Content } = Layout;
import Link from "next/link";
import SearchBar from "./SearchBar";
import styles from "./MainLayout.module.css";
import { useRouter } from "next/router";

const navs = [
  ["Blocks", "/blocks"],
  ["Extrinsics", "/extrinsics"],
  ["Events", "/events"],
];

function Navs() {
  const router = useRouter();
  return (
    <Menu 
      className={styles.navs}
      theme="dark"
      mode="horizontal"
      selectedKeys={navs.filter(v => router.pathname.startsWith(v[1])).map(v => v[1])}
    >
      {navs.map(([title, href]) => {
          return (
            <Menu.Item key={href}>
              <Link href={href}>{title}</Link>
            </Menu.Item>
          );
      })}
    </Menu>
  );
}

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
        { noSearch ? <div /> : <SearchBar /> }
        {children}
      </Content>
    </Layout>
  );
}
