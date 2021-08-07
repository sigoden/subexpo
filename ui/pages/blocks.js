import { Table } from "antd";
import Link from "next/link";
import { useRequest } from "@umijs/hooks";
import { ecllipseHash } from "../lib/utils";
import TimeAgo from "../components/TimeAgo";
import MainLayout from "../components/MainLayout";
import FinalizedStatus from "../components/FinializeStatus";

async function listExtrinsics(paginatedParams) {
  return fetch(`/api/blocks?current=${paginatedParams.current}&pageSize=${paginatedParams.pageSize}`)
    .then((res) => res.json())
}

const columns = [
  {
    title: "Block",
    dataIndex: "blockNum",
    render: blockNum => <Link href={`/blocks/${blockNum}`}><a>{blockNum}</a></Link>
  },
  {
    title: "Status",
    dataIndex: "finalized",
    render: finalized => <FinalizedStatus finalized={finalized} />,
  },
  {
    title: "Time",
    dataIndex: "blockAt",
    render: blockAt => <TimeAgo time={blockAt} />
  },
  {
    title: "Extrinsics",
    dataIndex: "extrinsicsCount",
    render: (extrinsicsCount, record) => extrinsicsCount > 0 ? <Link href={`/blocks/${record.blockNum}?tab=extrinsics`}><a>{extrinsicsCount}</a></Link> : extrinsicsCount,
  },
  {
    title: "Events",
    dataIndex: "eventsCount",
    render: (eventsCount, record) => eventsCount > 0 ? <Link href={`/blocks/${record.blockNum}?tab=events`}><a>{eventsCount}</a></Link> : eventsCount,
  },
  {
    title: "Validator",
    dataIndex: "validator",
    render: hash => <Link href={`/accounts/${hash}`}><a>{ecllipseHash(hash)}</a></Link>,
  },
  {
    title: "Block hash",
    dataIndex: "blockHash",
    render: (hash, record) => <Link href={`/blocks/${record.blockNum}`}><a>{ecllipseHash(hash)}</a></Link>,
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
