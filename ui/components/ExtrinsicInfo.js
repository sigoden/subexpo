import { Col, Row } from "antd";
import Link from "next/link";
import { CopyOutlined, CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { formatTimeUtc } from "../lib/utils";
import Args from "./Args";

import styles from "./ExtrinsicInfo.module.css";

export default function ExtrinsicInfo({ block, extrinsic }) {

  return (
    <div className={styles.container}>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Timestamp</Col>
        <Col className={styles.itemValue}>
          {formatTimeUtc(extrinsic.blockAt * 1000)}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Block</Col>
        <Col className={styles.itemValue}>
          <span>
            {block.finalized ? 
              <CheckCircleOutlined /> :
              <ClockCircleOutlined />}
            {extrinsic.blockNum}
          </span>
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Extrinsic Hash</Col>
        <Col className={styles.itemValue}>
          {extrinsic.extrinsicHash} <CopyOutlined />
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Module</Col>
        <Col className={styles.itemValue}>
          {extrinsic.section}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Call</Col>
        <Col className={styles.itemValue}>
          {extrinsic.method}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Call</Col>
        <Col className={styles.itemValue}>
          {extrinsic.method}
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Parameters</Col>
        <Col className={styles.itemValue}>
          <Args args={extrinsic.args}/>
        </Col>
      </Row>
      {extrinsic.isSigned && (
        <>
          <Row className={styles.item}>
            <Col className={styles.itemLabel} md={6}>Fee</Col>
            <Col className={styles.itemValue}>
              {extrinsic.fee}
            </Col>
          </Row>
          <Row className={styles.item}>
            <Col className={styles.itemLabel} md={6}>Nonce</Col>
            <Col className={styles.itemValue}>
              {extrinsic.nonce}
            </Col>
          </Row>
          <Row className={styles.item}>
            <Col className={styles.itemLabel} md={6}>Result</Col>
            <Col className={styles.itemValue}>
              {block.success ? 
                <span><CheckCircleOutlined /> Success</span> :
                <span><ClockCircleOutlined /> Failed</span>}
            </Col>
          </Row>
          <Row className={styles.item}>
            <Col className={styles.itemLabel} md={6}>Signature</Col>
            <Col className={styles.itemSignature}>
              {extrinsic.signature}
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}