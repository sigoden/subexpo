import { Table } from "antd";
import { MinusSquareOutlined, PlusSquareOutlined } from "@ant-design/icons";
import Args from "./Args";

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
  console.log(props.dataSource);
  return (
    <Table
      columns={columns}
      rowKey="logId"
      expandIconColumnIndex={Number.MAX_SAFE_INTEGER}
      expandIcon={({ expanded, onExpand, record }) =>
        expanded ? (
          <MinusSquareOutlined onClick={e => onExpand(record, e)} />
        ) : (
          <PlusSquareOutlined onClick={e => onExpand(record, e)} />
        )
      }
      expandable={{
        expandedRowRender: record => <Args args={
          record.data.map((item, index) => ({ name: index + 1, value: item }))
        } />
      }}
      {...props} />
  );
}