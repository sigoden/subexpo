import React from "react";
import { Layout, Row, Col, Menu } from "antd";
const { Header, Content } = Layout;
import Link from "next/link";
import SearchBar from "./SearchBar";
import styles from "./MainLayout.module.css";

const navs = [
  ["Blocks", "/blocks"],
  ["Extrinsics", "/extrinsics"],
  ["Events", "/events"],
  ["Accounts", "/accounts"],
];

export default function MainLayout({ children, noSearch }) {
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
            <Menu className={styles.navs} theme="dark" mode="horizontal">
              {navs.map(([title, href], index) => {
                  return (
                    <Menu.Item key={index+1}>
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
