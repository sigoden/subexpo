import { Button, Col, Row, Tabs, Grid } from "antd";
import { useRouter } from "next/router";

import prisma from "../../lib/prisma";
import { createApi } from "../../lib/api";
import MainLayout from "../../components/MainLayout";
import SearchBar from "../../components/SearchBar";
import ExtrinsicTable from "../../components/ExtrinsicTable";
import AccountInfo from "../../components/AccountInfo";

import styles from "./[id].module.css";
import { useCallback, useState } from "react";
const { TabPane } = Tabs;

export async function getServerSideProps({ params }) {
  const { id } = params;
  const api = await createApi();
  const accountInfo = await api.query.system.account(id);
  if (accountInfo) {
    const extrinsics = await prisma.chainExtrinsic.findMany({
      where: { accountId: id },
      orderBy: { blockNum: "desc" },
      take: 10,
    })
    return {
      props: {
        id,
        free: accountInfo.data.free.toString(),
        reserved: accountInfo.data.reserved.toString(),
        nonce: accountInfo.nonce.toNumber(),
        extrinsics,
      }
    }
  }
  return { notFound: true };
}


export default function AccountPage(account) {
  const router = useRouter();
  const {id, extrinsics} = account;
  const [tabKey, setTabKey] = useState("extrinsics");
  const onTabChange = useCallback(key => {
    setTabKey(key);
  }, [setTabKey])
  const onViewAll = useCallback(() => {
    if (tabKey === "extrinsics") {
      router.push(`/extrinsics?accountId=${id}`);
    }
  }, [tabKey, router, id]);
  return (
    <div>
      <Row>
        <Col xs={24} className={styles.accountId}>
          <div className={styles.accountIdValue}>{id}</div>
        </Col>
        <Col xs={24} className="wrapSearchBar">
          <SearchBar />
        </Col>
      </Row>
      <AccountInfo account={account} />
      {extrinsics.length > 0 &&
        <Tabs 
          className={styles.tabs}
          defaultActiveKey={tabKey}
          onChange={onTabChange}
          tabBarExtraContent={<Button onClick={onViewAll}>View All</Button>}>
          <TabPane tab={`Extrinsics(${extrinsics.length})`} key="extrinsics">
            <ExtrinsicTable dataSource={extrinsics} inBlock pagination={false} />
          </TabPane>
        </Tabs>
      }
    </div>
  )
}

AccountPage.getLayout = (page) => (
  <MainLayout noSearch>{page}</MainLayout>
)
