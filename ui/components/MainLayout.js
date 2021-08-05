import React from "react";
import { Layout, Row, Col, Input, Menu } from "antd";
const { Header, Content } = Layout;
const { Search } = Input;
import Link from "next/link";
import styles from "./MainLayout.module.css";

const navs = [
  ["Blocks", "/blocks"],
  ["Extrinsics", "/extrinsics"],
  ["Events", "/events"],
  ["Accounts", "/accounts"],
];

const onSearch = v => console.log(v);
export default function MainLayout({ children }) {
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
        <div className={styles.wrapSearch}>
          <Search
            className={styles.search}
            placeholder="Search by Block / Extrinsic / Account"
            enterButton="Search"
            size="large"
            onSearch={onSearch}
          />
        </div>
        {children}
      </Content>
    </Layout>
  );
}
