import { Table } from "antd";
import Link from "next/link";
import { CheckCircleOutlined, CloseCircleOutlined, MinusSquareOutlined, PlusSquareOutlined } from "@ant-design/icons";
import { ecllipseHash, formatTimeAgo } from "../lib/utils";
import Args from "./Args";

const columns = [
  {
    title: "ID",
    dataIndex: "extrinsicId",
    render: (extrinsicId) => <Link href={`/extrinsics/${extrinsicId}`}><a>{extrinsicId}</a></Link>
  },
  {
    title: "Block",
    dataIndex: 'blockNum',
    render: blockNum => <Link href={`/blocks/${blockNum}`}><a>{blockNum}</a></Link>
  },
  {
    title: "Hash",
    dataIndex: "extrinsicHash",
    render: (hash, record) => <Link href={`/extrinsics/${record.extrinsicId}`}><a>{ecllipseHash(hash)}</a></Link>,
  },
  {
    title: "Time",
    dataIndex: "blockAt",
    render: blockAt => formatTimeAgo(blockAt * 1000),
  },
  {
    title: "Result",
    dataIndex: 'success',
    render: success => success ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
  },
  {
    title: "Action",
    key: "action",
    dataIndex: "section",
    render: (_, record) => {
      const { section, method } = record;
      return <Link href={`/extrinsics?section=${section}&method=${method}`}><a>{`${section}(${method})`}</a></Link>
    }
  },
];

export default function ExtrinsicTable (props) {
  return (
    <Table 
      columns={props.inBlock ?
        columns.filter(v => v.dataIndex !== "blockNum" && v.dataIndex !== "blockAt") :
        columns}
      rowKey="extrinsicId" 
      expandIconColumnIndex={Number.MAX_SAFE_INTEGER}
      expandIcon={({ expanded, onExpand, record }) =>
        expanded ? (
          <MinusSquareOutlined onClick={e => onExpand(record, e)} />
        ) : (
          <PlusSquareOutlined onClick={e => onExpand(record, e)} />
        )
      }
      expandable={{
        expandedRowRender: record => <Args args={record.args} />
      }}
      {...props} 
    />
  )
}