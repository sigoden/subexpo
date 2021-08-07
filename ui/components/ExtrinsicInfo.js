import { Col, Row } from "antd";
import { formatTimeUtc } from "../lib/utils";
import Args from "./Args";

import styles from "./ExtrinsicInfo.module.css";
import FinalizedStatus from "./FinializeStatus";
import ExtrinsicResult from "./ExtrinsicResult";
import CopyClipboard from "./CopyClipboard";

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
            <FinalizedStatus finalized={block.finalized} />
            {extrinsic.blockNum}
          </span>
        </Col>
      </Row>
      <Row className={styles.item}>
        <Col className={styles.itemLabel} md={6}>Extrinsic Hash</Col>
        <Col className={styles.itemValue}>
          {extrinsic.extrinsicHash} <CopyClipboard text={extrinsic.extrinsicHash} />
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
            <Col className={styles.itemLabel} md={6}>Sender</Col>
            <Col className={styles.itemValue}>
              {extrinsic.accountId} <CopyClipboard text={extrinsic.accountId} />
            </Col>
          </Row>
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
              <ExtrinsicResult success={block.success} text />
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