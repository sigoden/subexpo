import React from "react";
import { Layout, Row, Col, Menu } from "antd";
const { Header, Content } = Layout;
import Link from "next/link";
import SearchBar from "./SearchBar";
import styles from "./MainLayout.module.css";
import { useRouter } from "next/router";

const navs = [
  ["Blocks", "/blocks"],
  ["Extrinsics", "/extrinsics"],
  ["Events", "/events"],
  ["Accounts", "/accounts"],
];

export default function MainLayout({ children, noSearch }) {
  const router = useRouter();
  return (
    <Layout>
      <Header>
        <Row className={styles.header}>
          <Col>
            <div className={styles.logo}>
              <Link href="/">SUBEXPO</Link>
            </div>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
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
          </Col>
        </Row>
      </Header>
      <Content className={styles.wrapContent}>
        { noSearch ? <div /> : <SearchBar /> }
        {children}
      </Content>
    </Layout>
  );
}
