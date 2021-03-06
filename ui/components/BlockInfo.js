import { Col, Row } from "antd";
import Link from "next/link";
import TimeAgo from "./TimeAgo";
import { formatTimeUtc } from "../lib/utils";
import FinalizedStatus from "./FinializeStatus";
import CopyClipboard from "./CopyClipboard";

import styles from "./BlockInfo.module.css";

const items = [
  {
    title: "TimeStamp",
    render: (block) => formatTimeUtc(block.blockAt * 1000),
    when: (block) => block.blockNum > 0,
  },
  {
    title: "Status",
    render: (block) => <FinalizedStatus text finalized={block.finalized} />,
  },
  {
    title: "Block Hash",
    render: (block) => (
      <>
        {block.blockHash} <CopyClipboard text={block.blockHash} />
      </>
    ),
  },
  {
    title: "Parent Hash",
    render: (block) => (
      <Link href={`/blocks/${block.blockNum - 1}`}>
        <a>{block.parentHash}</a>
      </Link>
    ),
  },
  {
    title: "State Root",
    render: (block) => block.stateRoot,
  },
  {
    title: "Extrinsics Root",
    render: (block) => block.extrinsicsRoot,
  },
  {
    title: "Validator",
    render: (block) => (
      <>
        <Link href={`/accounts/${block.validator}`}>
          <a>{block.validator}</a>
        </Link>
        <CopyClipboard text={block.validator} />
      </>
    ),
    when: (block) => block.validator,
  },
  {
    title: "BlockTime",
    render: (block) => <TimeAgo time={block.blockAt} />,
    when: (block) => block.blockNum > 0,
  },
  {
    title: "Spec Version",
    render: (block) => block.specVersion,
  },
];

export default function BlockInfo({ block }) {
  return (
    <div className={styles.container}>
      {items
        .filter(({ when }) => typeof when === "undefined" || when(block))
        .map(({ title, render }) => (
          <Row className={styles.item} key={title}>
            <Col className={styles.itemLabel} xs={24} sm={4}>
              {title}
            </Col>
            <Col className={styles.itemValue} xs={24} sm={20}>
              {render(block)}
            </Col>
          </Row>
        ))}
    </div>
  );
}
