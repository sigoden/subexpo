import { Button, Col, Row, Tabs, Grid } from "antd";
import { useRouter } from "next/router";

import prisma from "../../lib/prisma";
import { createApi } from "../../lib/api";
import MainLayout from "../../components/MainLayout";
import SearchBar from "../../components/SearchBar";
import ExtrinsicTable from "../../components/ExtrinsicTable";
import TransferTable from "../../components/TransferTable";
import AccountInfo from "../../components/AccountInfo";

import styles from "./[id].module.css";
import { useCallback, useState } from "react";
const { TabPane } = Tabs;

export async function getServerSideProps({ params }) {
  const { id } = params;
  const api = await createApi();
  const accountInfo = await api.query.system.account(id);
  if (accountInfo) {
    const [extrinsics, extrinsicsCount, transfers, transfersCount] = await Promise.all([
      await prisma.chainExtrinsic.findMany({
        where: { accountId: id },
        orderBy: { blockNum: "desc" },
        take: 10,
      }),
      await prisma.chainExtrinsic.count({
        where: { accountId: id },
      }),
      await prisma.chainTransfer.findMany({
        where: {
          OR: [
            { from: id },
            { to: id },
          ]
        },
        orderBy: { blockNum: "desc" },
        take: 10,
      }),
      await prisma.chainTransfer.count({
        where: {
          OR: [
            { from: id },
            { to: id },
          ]
        },
      }),
    ])
    return {
      props: {
        id,
        free: accountInfo.data.free.toString(),
        reserved: accountInfo.data.reserved.toString(),
        nonce: accountInfo.nonce.toNumber(),
        extrinsics,
        extrinsicsCount,
        transfers,
        transfersCount,
      }
    }
  }
  return { notFound: true };
}


export default function AccountPage(account) {
  const router = useRouter();
  const {id, extrinsics, extrinsicsCount, transfers, transfersCount} = account;
  const [tabKey, setTabKey] = useState("extrinsics");
  const onTabChange = useCallback(key => {
    setTabKey(key);
  }, [setTabKey])
  const onViewAll = useCallback(() => {
    router.push(`/${tabKey}?accountId=${id}`);
  }, [tabKey, router, id]);
  return (
    <div>
      <Row>
        <Col className={styles.accountId}>
          <div className={styles.accountIdValue}>{id}</div>
        </Col>
        <Col className="wrapSearchBar">
          <SearchBar />
        </Col>
      </Row>
      <AccountInfo account={account} />
      {extrinsicsCount + transfersCount > 0 && (
      <Tabs 
        className={styles.tabs}
        defaultActiveKey={tabKey}
        onChange={onTabChange}
        tabBarExtraContent={<Button onClick={onViewAll}>View All</Button>}>
        {extrinsicsCount > 0 && (
        <TabPane tab={`Extrinsics(${extrinsicsCount})`} key="extrinsics">
          <ExtrinsicTable dataSource={extrinsics} noColumns={["blockNum", "extrinsicHash"]} pagination={false} />
        </TabPane>)}
        {transfersCount > 0 && (
        <TabPane tab={`Transfers(${transfersCount})`} key="transfers">
          <TransferTable dataSource={transfers} accountId={id} pagination={false} />
        </TabPane>)}
      </Tabs>)}
    </div>
  )
}

AccountPage.getLayout = (page) => (
  <MainLayout noSearch>{page}</MainLayout>
)
