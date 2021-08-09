import { Col, Row } from "antd";
import Link from "next/link";
import { formatTimeUtc } from "../lib/utils";
import Args from "./Args";

import styles from "./ExtrinsicInfo.module.css";
import FinalizedStatus from "./FinializeStatus";
import ExtrinsicResult from "./ExtrinsicResult";
import CopyClipboard from "./CopyClipboard";
import Balance from "./Balance";

const items  = [
  {
    title: "TimeStamp",
    show: () => true,
    render: extrinsic => formatTimeUtc(extrinsic.blockAt * 1000),
  },
  {
    title: "Block",
    show: () => true,
    render: extrinsic => (
        <span>
          <FinalizedStatus finalized={extrinsic.finalized} />
          <Link href={`/blocks/${extrinsic.blockNum}`}><a>{extrinsic.blockNum}</a></Link>
        </span>
    )
  },
  {
    title: "Extrinsic Hash",
    show: () => true,
    render: extrinsic => (
      <>
        {extrinsic.extrinsicHash} <CopyClipboard text={extrinsic.extrinsicHash} />
      </>
    ),
  },
  {
    title: "Module",
    show: () => true,
    render: extrinsic => extrinsic.section,
  },
  {
    title: "Call",
    show: () => true,
    render: extrinsic => extrinsic.method,
  },
  {
    title: "Sender",
    show: extrinsic => extrinsic.isSigned,
    render: extrinsic => (
      <>
        <Link href={`/accounts/${extrinsic.accountId}`}><a>{extrinsic.accountId}</a></Link>
        <CopyClipboard text={extrinsic.accountId} />
      </>
    ),
  },
  {
    title: "Fee",
    show: extrinsic => extrinsic.isSigned,
    render: extrinsic => <Balance balance={extrinsic.fee} />,
  },
  {
    title: "Tip",
    show: extrinsic => extrinsic.tip !== "0",
    render: extrinsic => <Balance balance={extrinsic.tip} />,
  },
  {
    title: "Nonce",
    show: extrinsic => extrinsic.isSigned,
    render: extrinsic => extrinsic.nonce,
  },
  {
    title: "Result",
    show: () => true,
    render: extrinsic => extrinsic.success ?
          <ExtrinsicResult success={true} detail={<span>Success</span>} /> :
          <ExtrinsicResult success={false} detail={<span>Failed ({extrinsic.error.name})</span>} />
  },
  {
    title: "Parameters",
    show: () => true,
    render: extrinsic => <Args args={extrinsic.args}/>,
  },
  {
    title: "Signature",
    show: extrinsic => extrinsic.isSigned,
    cls: styles.itemSignature,
    render: extrinsic => extrinsic.signature,
  }
];

export default function ExtrinsicInfo({ extrinsic }) {
  const filterdItems = items.filter(v => v.show(extrinsic));
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