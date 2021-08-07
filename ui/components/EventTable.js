import { Table } from "antd";
import Link from "next/link";
import { formatTimeAgo } from "../lib/utils";

const columns = [
  {
    title: "ID",
    dataIndex: "eventId",
    render: (eventId) => <Link href={`/events/${eventId}`}><a>{eventId}</a></Link>
  },
  {
    title: "Block",
    dataIndex: 'blockNum',
    render: blockNum => <Link href={`/blocks/${blockNum}`}><a>{blockNum}</a></Link>
  },
  {
    title: "Extrinsic ID",
    dataIndex: "extrinsicId",
    render: extrinsicId => <Link href={`/extrinsics/${extrinsicId}`}><a>{extrinsicId}</a></Link>,
  },
  {
    title: "Time",
    dataIndex: "blockAt",
    render: blockAt => formatTimeAgo(blockAt * 1000),
  },
  {
    title: "Action",
    key: "action",
    dataIndex: "section",
    render: (_, record) => {
      const { section, method } = record;
      return <Link href={`/events?section=${section}&method=${method}`}><a>{`${section}(${method})`}</a></Link>
    }
  },
];

export default function EventTable(props) {
  let filterdColumns;
  if (props.inBlock) {
    filterdColumns = columns.filter(v => v.dataIndex !== "blockAt");
  } else if (props.inExtrinsic) {
    filterdColumns = columns.filter(v => v.dataIndex !== "blockAt" && v.dataIndex !== "extrinsicId");
  } else {
    filterdColumns = columns;
  }
  return (
    <Table
      columns={filterdColumns}
      rowKey="eventId"
      {...props} 
    />
  );
}