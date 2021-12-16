import React, { useEffect, useState } from "react";
import { Row, Col, Button } from "antd";
import { useRequest } from "ahooks";
import Link from "next/link";
import { formatNum, formatNumIdx, loadJson } from "../lib/utils";
import TimeAgo from "./TimeAgo";
import FinalizedStatus from "./FinializeStatus";
import styles from "./BlocksAndEvents.module.css";

function Block({ blockNum, eventsCount, extrinsicsCount, blockAt, finalized }) {
  return (
    <Row className={styles.block}>
      <Col>
        <Row className={styles.blockNum}>
          <div className={styles.blockNumTitle}>Block#</div>
          <div className={styles.blockNumValue}>
            <Link href={`/blocks/${blockNum}`}>{formatNum(blockNum)}</Link>
          </div>
        </Row>
        <Row className={styles.blockStats}>
          <div className={styles.blockStatsText}>Includes</div>
          <div className={styles.blockStatsList}>
            <Link href={`/blocks/${blockNum}?tab=extrinsics`}>
              <a>{extrinsicsCount} Extrinsic</a>
            </Link>
            {eventsCount.length ? (
              <Link href={`/blocks/${blockNum}?tab=events`}>
                <a style={{ marginLeft: "0.75rem" }}>{eventsCount} Event</a>
              </Link>
            ) : (
              <div style={{ marginLeft: "0.75rem" }}>{eventsCount} Event</div>
            )}
          </div>
        </Row>
      </Col>
      <Col className={styles.blockStateBox}>
        <Col>
          <TimeAgo time={blockAt} />
        </Col>
        <Col className={styles.blockFinialized}>
          <FinalizedStatus finalized={finalized} />
        </Col>
      </Col>
    </Row>
  );
}

function Event({ section, method, eventId, extrinsicId }) {
  return (
    <Row className={styles.event}>
      <Col>{section + "." + method}</Col>
      <Col className={styles.eventId}>
        <Link href={`/extrinsics/${extrinsicId}?event=${eventId}`}>
          <a>{formatNumIdx(eventId)}</a>
        </Link>
      </Col>
    </Row>
  );
}

export default function BlocksAndEvents({ blocks, events }) {
  const [state, setState] = useState({ blocks, events });
  const { data } = useRequest(() => loadJson("/api/pollinfo"), {
    pollingInterval: 2000,
    pollingWhenHidden: false,
  });
  useEffect(() => {
    if (Array.isArray(data?.blocks)) setState(data);
  }, [data]);
  return (
    <Row>
      <Col xs={24} md={12} className={styles.panel}>
        <Row
          align="middle"
          justify="space-between"
          className={styles.panelHeader}
        >
          <Col className={styles.panelTitle}>Recent Blocks</Col>
          <Col>
            <Link passHref href="/blocks">
              <Button className={styles.allBtn}>All</Button>
            </Link>
          </Col>
        </Row>
        <Row style={{ flexDirection: "column" }} className={styles.panelBody}>
          {state.blocks.map((block) => (
            <Block key={block.blockNum} {...block} />
          ))}
        </Row>
      </Col>
      <Col xs={24} md={12} className={styles.panel}>
        <Row
          align="middle"
          justify="space-between"
          className={styles.panelHeader}
        >
          <Col className={styles.panelTitle}>Recent Events</Col>
          <Col>
            <Link passHref href="/events">
              <Button className={styles.allBtn}>All</Button>
            </Link>
          </Col>
        </Row>
        <Row style={{ flexDirection: "column" }} className={styles.panelBody}>
          {state.events.map((event) => (
            <Event key={event.eventId} {...event} />
          ))}
        </Row>
      </Col>
    </Row>
  );
}
