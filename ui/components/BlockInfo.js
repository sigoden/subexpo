import { Col, Row } from "antd";
import Link from "next/link";
import { CopyOutlined, CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { formatTimeAgo, formatTimeUtc } from "../lib/utils";

import styles from "./BlockInfo.module.css";

export default function BlockInfo({ block }) {
  return (
    <div className={styles.container}>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Timestamp</Col>
        <Col className={styles.itemValue}>
          {formatTimeUtc(block.blockAt * 1000)}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Status</Col>
        <Col className={styles.itemValue}>
          {block.finalized ? 
            <span><CheckCircleOutlined /> Finalized</span> :
            <span><ClockCircleOutlined /> Unfinalized</span>}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Hash</Col>
        <Col className={styles.itemValue}>
          {block.blockHash} <CopyOutlined />
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Parent Hash</Col>
        <Col className={styles.itemValue}>
          <Link href={`/blocks/${block.blockNum - 1}`}><a>{block.parentHash}</a></Link>
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>State Root</Col>
        <Col className={styles.itemValue}>
          {block.stateRoot}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Extrinsics Root</Col>
        <Col className={styles.itemValue}>
          {block.extrinsicsRoot}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Validator</Col>
        <Col className={styles.itemValue}>
          {block.validator} <CopyOutlined />
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Block Time</Col>
        <Col className={styles.itemValue}>
          {formatTimeAgo(block.blockAt * 1000)}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Spec Version</Col>
        <Col className={styles.itemValue}>
          {block.specVersion}
        </Col>
      </Row>
    </div>
  );
}