import { Col, Row, Tabs } from "antd";
import { useRouter } from "next/router";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useCallback } from "react";

import getPrisma from "../../lib/prisma";
import MainLayout from "../../components/MainLayout";
import SearchBar from "../../components/SearchBar";
import BlockInfo from "../../components/BlockInfo";
import ExtrinsicTable from "../../components/ExtrinsicTable";
import EventTable from "../../components/EventTable";
import LogTable from "../../components/LogTable";

import styles from "./[id].module.css";
const { TabPane } = Tabs;

export async function getServerSideProps({ params }) {
  const prisma = getPrisma();
  const { id } = params;
  let block;
  if (/^\d+$/.test(id)) {
    block = await prisma.chainBlock.findFirst({
      where: { blockNum: parseInt(id) },
    });
  } else if (id.startsWith("0x") && id.length === 66) {
    block = await prisma.chainBlock.findFirst({ where: { blockHash: id } });
  }
  if (!block) {
    return { notFound: true };
  }
  const [extrinsics, events, logs] = await Promise.all([
    prisma.chainExtrinsic.findMany({ where: { blockNum: block.blockNum } }),
    block.eventsCount
      ? prisma.chainEvent.findMany({ where: { blockNum: block.blockNum } })
      : Promise.resolve([]),
    prisma.chainLog.findMany({ where: { blockNum: block.blockNum } }),
  ]);
  return { props: { block, extrinsics, events, logs } };
}

export default function BlockPage({ block, events, extrinsics, logs }) {
  const { blockNum } = block;
  const router = useRouter();
  const offsetBlock = useCallback(
    (offset) => {
      router.push(`/blocks/${Math.max(0, blockNum + offset)}`);
    },
    [router, blockNum]
  );
  return (
    <div>
      <Row>
        <Col className={styles.blockNav}>
          <LeftOutlined
            className={styles.blockNavBtn}
            onClick={() => offsetBlock(-1)}
          />
          <div className={styles.blockNavValue}>Block#{block.blockNum}</div>
          <RightOutlined
            className={styles.blockNavBtn}
            onClick={() => offsetBlock(1)}
          />
        </Col>
        <Col className="wrapSearchBar">
          <SearchBar />
        </Col>
      </Row>
      <BlockInfo block={block} />
      {extrinsics.length > 0 && (
        <Tabs
          className={styles.tabs}
          defaultActiveKey={router.query.tab || "extrinsics"}
        >
          <TabPane tab={`Extrinsics(${extrinsics.length})`} key="extrinsics">
            <ExtrinsicTable
              dataSource={extrinsics}
              noColumns={["blockNum", "blockAt"]}
              pagination={false}
            />
          </TabPane>
          {events.length > 0 && (
            <TabPane tab={`Events(${events.length})`} key="events">
              <EventTable dataSource={events} inBlock pagination={false} />
            </TabPane>
          )}
          <TabPane tab={`Logs(${logs.length})`} key="logs">
            <LogTable dataSource={logs} pagination={false} />
          </TabPane>
        </Tabs>
      )}
    </div>
  );
}

BlockPage.getLayout = (page) => <MainLayout noSearch>{page}</MainLayout>;
