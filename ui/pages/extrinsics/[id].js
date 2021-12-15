import { Col, Row, Tabs } from "antd";

import prisma from "../../lib/prisma";
import MainLayout from "../../components/MainLayout";
import SearchBar from "../../components/SearchBar";
import EventTable from "../../components/EventTable";
import ExtrinsicInfo from "../../components/ExtrinsicInfo";

import styles from "./[id].module.css";
const { TabPane } = Tabs;

export async function getServerSideProps({ params }) {
  const { id } = params;
  if (typeof id === "string") {
    const where = /^\d+-\d+$/.test(id)
      ? { extrinsicId: id }
      : { extrinsicHash: id };
    const extrinsic = await prisma.chainExtrinsic.findFirst({ where });
    if (extrinsic) {
      const events = await prisma.chainEvent.findMany({
        where: { extrinsicId: extrinsic.extrinsicId },
      });
      return { props: { extrinsic, events } };
    }
  }
  return { notFound: true };
}

export default function ExtrinsicPage({ events, extrinsic }) {
  const { extrinsicId } = extrinsic;
  return (
    <div>
      <Row>
        <Col className={styles.extrinsicId}>
          <div className={styles.extrinsicIdValue}>Extrinsic#{extrinsicId}</div>
        </Col>
        <Col className="wrapSearchBar">
          <SearchBar />
        </Col>
      </Row>
      <ExtrinsicInfo extrinsic={extrinsic} />
      {events.length > 0 && (
        <Tabs className={styles.tabs} defaultActiveKey="events">
          <TabPane tab={`Events(${events.length})`} key="events">
            <EventTable dataSource={events} inExtrinsic pagination={false} />
          </TabPane>
        </Tabs>
      )}
    </div>
  );
}

ExtrinsicPage.getLayout = (page) => <MainLayout noSearch>{page}</MainLayout>;
