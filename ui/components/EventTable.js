import { Table } from "antd";
import Link from "next/link";
import TimeAgo from "./TimeAgo";
import Args from "./Args";
import ExpandIcon from "./ExpandIcon";

const columns = [
  {
    title: "ID",
    dataIndex: "eventId",
    render: (eventId, record) =>
      record.extrinsicId ? (
        <Link href={`/extrinsics/${record.extrinsicId}?tab=events`}>
          <a>{eventId}</a>
        </Link>
      ) : (
        <Link href={`/blocks/${record.blockNum}?tab=events`}>
          <a>{eventId}</a>
        </Link>
      ),
  },
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
    title: "Extrinsic ID",
    dataIndex: "extrinsicId",
    render: (extrinsicId) => (
      <Link href={`/extrinsics/${extrinsicId}`}>
        <a>{extrinsicId}</a>
      </Link>
    ),
  },
  {
    title: "Time",
    dataIndex: "blockAt",
    render: (blockAt) => <TimeAgo time={blockAt} />,
  },
  {
    title: "Action",
    key: "action",
    dataIndex: "section",
    render: (_, record) => {
      const { section, method } = record;
      return (
        <Link href={`/events?section=${section}&method=${method}`}>
          <a>{`${section}(${method})`}</a>
        </Link>
      );
    },
  },
];

export default function EventTable(props) {
  let filterdColumns;
  if (props.inBlock) {
    filterdColumns = columns.filter((v) => v.dataIndex !== "blockAt");
  } else if (props.inExtrinsic) {
    filterdColumns = columns.filter(
      (v) => v.dataIndex !== "blockAt" && v.dataIndex !== "extrinsicId"
    );
  } else {
    filterdColumns = columns;
  }
  return (
    <Table
      columns={filterdColumns}
      rowKey="eventId"
      expandIconColumnIndex={Number.MAX_SAFE_INTEGER}
      expandIcon={(props) =>
        props.record.data?.length > 0 ? <ExpandIcon {...props} /> : null
      }
      expandable={{
        expandedRowRender: (record) => (
          <div className="args">
            <Args args={record.data} />
          </div>
        ),
      }}
      {...props}
    />
  );
}
