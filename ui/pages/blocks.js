import { Table } from "antd";
import Link from "next/link";
import { useRequest } from "@umijs/hooks";
import { CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { ecllipseHash, formatTimeAgo } from "../lib/utils";
import MainLayout from "../components/MainLayout";

async function listExtrinsics(paginatedParams) {
  return fetch(`/api/blocks?current=${paginatedParams.current}&pageSize=${paginatedParams.pageSize}`)
    .then((res) => res.json())
}

const columns = [
  {
    title: "Block",
    dataIndex: "blockNum",
    render: blockNum => <Link href={`/block/${blockNum}`}><a>{blockNum}</a></Link>
  },
  {
    title: "Status",
    dataIndex: "finalized",
    render: finalized => finalized ? <CheckCircleOutlined /> : <ClockCircleOutlined />
  },
  {
    title: "Time",
    dataIndex: "blockAt",
    render: blockAt => formatTimeAgo(blockAt * 1000),
  },
  {
    title: "Extrinsics",
    dataIndex: "extrinsicsCount",
    render: (extrinsicsCount, record) => extrinsicsCount > 0 ? <Link href={`/block/${record.blockNum}?tab=events`}><a>{extrinsicsCount}</a></Link> : extrinsicsCount,
  },
  {
    title: "Events",
    dataIndex: "eventsCount",
    render: (eventsCount, record) => eventsCount > 0 ? <Link href={`/block/${record.blockNum}?tab=events`}><a>{eventsCount}</a></Link> : eventsCount,
  },
  {
    title: "Validator",
    dataIndex: "validator",
    render: hash => <Link href={`/account/${hash}`}><a>{ecllipseHash(hash)}</a></Link>,
  },
  {
    title: "Block hash",
    dataIndex: "blockHash",
    render: hash => <Link href={`/block/${hash}`}><a>{ecllipseHash(hash)}</a></Link>,
  }
]

export default function BlocksPage() {
  const { tableProps } = useRequest(params => listExtrinsics(params), {
    paginated: true,
    defaultPageSize: 20,
  });
  return (
    <Table columns={columns} rowKey="blockNum" {...tableProps} />
  );
}

BlocksPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)
