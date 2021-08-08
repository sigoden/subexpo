import { Col, Row } from "antd";
import { formatTimeUtc } from "../lib/utils";
import Args from "./Args";

import styles from "./ExtrinsicInfo.module.css";
import FinalizedStatus from "./FinializeStatus";
import ExtrinsicResult from "./ExtrinsicResult";
import CopyClipboard from "./CopyClipboard";

const items  = [
  {
    title: "TimeStamp",
    render: extrinsic => formatTimeUtc(extrinsic.blockAt * 1000),
  },
  {
    title: "Block",
    render: extrinsic => (
        <span>
          <FinalizedStatus finalized={extrinsic.finalized} />
          {extrinsic.blockNum}
        </span>
    )
  },
  {
    title: "Extrinsic Hash",
    render: extrinsic => (
      <>
        {extrinsic.extrinsicHash} <CopyClipboard text={extrinsic.extrinsicHash} />
      </>
    ),
  },
  {
    title: "Module",
    render: extrinsic => extrinsic.section,
  },
  {
    title: "Call",
    render: extrinsic => extrinsic.method,
  },
  {
    title: "Sender",
    needSign: true,
    render: extrinsic => (
      <>
        {extrinsic.accountId} <CopyClipboard text={extrinsic.accountId} />
      </>
    ),
  },
  {
    title: "Fee",
    needSign: true,
    render: extrinsic => extrinsic.fee,
  },
  {
    title: "Nonce",
    needSign: true,
    render: extrinsic => extrinsic.nonce,
  },
  {
    title: "Result",
    render: extrinsic => extrinsic.success ?
          <ExtrinsicResult success={true} detail={<span>Success</span>} /> :
          <ExtrinsicResult success={false} detail={<span>Failed ({extrinsic.error.name})</span>} />
  },
  {
    title: "Parameters",
    render: extrinsic => <Args args={extrinsic.args}/>,
  },
  {
    title: "Signature",
    needSign: true,
    cls: styles.itemSignature,
    render: extrinsic => extrinsic.signature,
  }
];

export default function ExtrinsicInfo({ extrinsic }) {
  const filterdItems = extrinsic.isSigned ? items : items.filter(v => !v.needSign);
  return (
    <div className={styles.container}>
      {filterdItems.map(({title, render, cls}) => (
        <Row className={styles.item} key={title}>
          <Col className={styles.itemLabel} md={4}>{title}</Col>
          <Col className={cls || styles.itemValue}>
            {render(extrinsic)}
          </Col>
        </Row>
      ))}
    </div>
  )
}