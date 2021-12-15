import { Table } from "antd";
import Link from "next/link";
import { ecllipseHash } from "../lib/utils";
import TimeAgo from "../components/TimeAgo";
import FinalizedStatus from "../components/FinializeStatus";
import styles from "./BlockTable.module.css";

const columns = [
  {
    title: "Block",
    dataIndex: "blockNum",
    render: (blockNum) => (
      <Link href={`/blocks/${blockNum}`}>
        <a>{blockNum}</a>
      </Link>
    ),
  },
  {
    title: "Status",
    dataIndex: "finalized",
    render: (finalized) => <FinalizedStatus finalized={finalized} />,
  },
  {
    title: "Time",
    dataIndex: "blockAt",
    render: (blockAt) => <TimeAgo time={blockAt} />,
  },
  {
    title: "Extrinsics",
    dataIndex: "extrinsicsCount",
    render: (extrinsicsCount, record) =>
      extrinsicsCount > 0 ? (
        <Link href={`/blocks/${record.blockNum}?tab=extrinsics`}>
          <a>{extrinsicsCount}</a>
        </Link>
      ) : (
        extrinsicsCount
      ),
  },
  {
    title: "Events",
    dataIndex: "eventsCount",
    render: (eventsCount, record) =>
      eventsCount > 0 ? (
        <Link href={`/blocks/${record.blockNum}?tab=events`}>
          <a>{eventsCount}</a>
        </Link>
      ) : (
        eventsCount
      ),
  },
  {
    title: "Validator",
    dataIndex: "validator",
    render: (hash) => (
      <Link href={`/accounts/${hash}`}>
        <a>{ecllipseHash(hash)}</a>
      </Link>
    ),
  },
  {
    title: "Block hash",
    dataIndex: "blockHash",
    render: (hash, record) => (
      <Link href={`/blocks/${record.blockNum}`}>
        <a>{ecllipseHash(hash)}</a>
      </Link>
    ),
  },
];

export default function BlockTable(props) {
  return <Table columns={columns} rowKey="blockNum" {...props} />;
}
