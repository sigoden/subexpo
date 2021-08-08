import { Col, Row } from "antd";
import Link from "next/link";
import TimeAgo from "./TimeAgo";
import { formatTimeUtc } from "../lib/utils";
import FinalizedStatus from "./FinializeStatus";
import CopyClipboard from "./CopyClipboard";

import styles from "./BlockInfo.module.css";

const items  = [
  {
    title: "TimeStamp",
    render: block => formatTimeUtc(block.blockAt * 1000),
  },
  {
    title: "Status",
    render: block => <FinalizedStatus text finalized={block.finalized} />

  },
  {
    title: "Block Hash",
    render: block => (
      <>
        {block.blockHash} <CopyClipboard text={block.blockHash} />
      </>
    ),
  },
  {
    title: "Parent Hash",
    render: block => <Link href={`/blocks/${block.blockNum - 1}`}><a>{block.parentHash}</a></Link>
  },
  {
    title: "State Root",
    render: block => block.stateRoot,
  },
  {
    title: "Extrinsics Root",
    render: block => block.extrinsicsRoot,
  },
  {
    title: "Validator",
    render: block => (
      <>
        {block.validator} <CopyClipboard text={block.validator} />
      </>
    ),
  },
  {
    title: "BlockTime",
    render: block => <TimeAgo time={block.blockAt} />
  },
  {
    title: "Spec Version",
    render: block => block.specVersion,
  },
];


export default function BlockInfo({ block }) {
  return (
    <div className={styles.container}>
      {items.map(({title, render}) => (
        <Row className={styles.item} key={title}>
          <Col className={styles.itemLabel} md={4}>{title}</Col>
          <Col className={styles.itemValue}>
            {render(block)}
          </Col>
        </Row>
      ))}
    </div>
  )
}