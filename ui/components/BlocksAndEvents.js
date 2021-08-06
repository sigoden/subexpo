import React, { useEffect, useState } from "react";
import { Row, Col, Button, Spin } from "antd";
import { useRequest } from "@umijs/hooks";
import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import Link from "next/link";

import styles from "./BlocksAndEvents.module.css";
import { formatNum, formatNumIdx, formatTimeAgo } from "../lib/utils";

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


function Block({ blockNum, eventsCount, exterinsicsCount, blockAt, finalized }) {
  return (
    <Row className={styles.block}>
      <Col>
        <Row className={styles.blockNum}>
          <div className={styles.blockNumTitle}>Block#</div>
          <div className={styles.blockNumValue}>{formatNum(blockNum)}</div>
        </Row>
        <Row className={styles.blockStats}>
          <div className={styles.blockStatsText}>Includes</div>
          <div className={styles.blockStatsList}>
            <div>{exterinsicsCount} Extrinsic</div>
            <div>{eventsCount} Event</div>
          </div>
        </Row>
      </Col>
      <Col className={styles.blockStateBox}>
        <Col>{formatTimeAgo(blockAt * 1000)}</Col>
        <Col className={styles.blockFinialized}>
          {finalized ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
        </Col>
      </Col>
    </Row>
  );
}

function Event({ section, method, eventId }) {
  return (
    <Row className={styles.event}>
      <Col>
        {section + "." + method}
      </Col>
      <Col className={styles.eventId}>
        {formatNumIdx(eventId)}
      </Col>
    </Row>
  );
} 

export default function BlocksAndEvents() {
  const [state, setState] = useState({blocks:[], events: []});
  const { data } = useRequest(
    { url: "/api/pollinfo" },
    {
      pollingInterval: 2000,
      pollingWhenHidden: false,
    }
  );
  useEffect(() => {
    if (Array.isArray(data?.blocks)) setState(data);
  }, [data]);
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
          {state.blocks.map(block => (
            <Block key={block.blockNum} {...block} />
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
          {state.events.map(event => (
            <Event key={event.eventId} {...event} />
          ))}
        </Row>
      </Col>
    </Row>
  )
}