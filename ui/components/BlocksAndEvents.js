import React from "react";
import { Row, Col, Button } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import Link from "next/link";

import styles from "./BlocksAndEvents.module.css";

const blocks = Array.from(Array(10)).map((_, index) => {
  return {
    blockNum: 62324 - index,
    eventsCount: 3,
    exterinsicsCount: 2,
    blockAt: Math.floor(Date.now() / 1000) - 6000 * index,
  };
});

const events = Array.from(Array(5)).map((_, index) => {
  return {
    eventId: (62324 - index) + "-" + 1,
    section: "session",
    method: "NewSession",
  };
});


function Block(props) {
  return (
    <Row className={styles.block}>
      <Col>
        <Row className={styles.blockNum}>
          <div className={styles.blockNumTitle}>Block#</div>
          <div className={styles.blockNumValue}>6,244,376</div>
        </Row>
        <Row className={styles.blockStats}>
          <div className={styles.blockStatsText}>Includes</div>
          <div className={styles.blockStatsList}>
            <div>2 Extrinsic</div>
            <div>2 Event</div>
          </div>
        </Row>
      </Col>
      <Col className={styles.blockStateBox}>
        <Col>10 sec ago</Col>
        <Col className={styles.blockFinialized}><CheckCircleOutlined /></Col>
      </Col>
    </Row>
  );
}

function Event(props) {
  return (
    <Row className={styles.event}>
      <Col>
        session.NewSession
      </Col>
      <Col className={styles.eventId}>
        39,920-2
      </Col>
    </Row>
  );
} 

export default function BlocksAndEvents() {
  return (
    <Row>
      <Col span={12} className={styles.panel}>
        <Row align="middle" justify="space-between" className={styles.panelHeader}>
          <Col className={styles.panelTitle}>
            Recent Blocks
          </Col>
          <Col>
            <Link href="/blocks">
              <Button className={styles.allBtn}>All</Button>
            </Link>
          </Col>
        </Row>
        <Row style={{flexDirection: "column"}} className={styles.panelBody}>
          {Array.from(Array(10)).map((_, index) => (
            <Block key={index} />
          ))}
        </Row>
      </Col>
      <Col span={12} className={styles.panel}>
        <Row align="middle" justify="space-between" className={styles.panelHeader}>
          <Col className={styles.panelTitle}>
            Recent Events
          </Col>
          <Col>
            <Link href="/events">
              <Button className={styles.allBtn}>All</Button>
            </Link>
          </Col>
        </Row>
        <Row style={{flexDirection: "column"}} className={styles.panelBody}>
          {Array.from(Array(20)).map((_, index) => (
            <Event key={index} />
          ))}
        </Row>
      </Col>
    </Row>
  )
}