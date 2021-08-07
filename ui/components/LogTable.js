import { Table } from "antd";

const columns = [
  {
    title: "ID",
    dataIndex: "logId",
  },
  {
    title: "Type",
    dataIndex: "logType",
  },
];

export default function EventTable(props) {
  return (
    <Table columns={columns} rowKey="logId" {...props} />
  );
}