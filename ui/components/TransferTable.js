import { Table } from "antd";
import Link from "next/link";
import { ecllipseHash } from "../lib/utils";
import TimeAgo from "./TimeAgo";
import ExtrinsicResult from "./ExtrinsicResult";
import Balance from "./Balance";

export default function TransferTable(props) {
  const columns = [
    {
      title: "ID",
      dataIndex: "extrinsicId",
      render: (extrinsicId) => (
        <Link href={`/extrinsics/${extrinsicId}`}>
          <a>{extrinsicId}</a>
        </Link>
      ),
    },
    {
      title: "From",
      dataIndex: "from",
      render: (from) =>
        from === props.accountId ? (
          ecllipseHash(from)
        ) : (
          <Link href={`/accounts/${from}`}>
            <a>{ecllipseHash(from)}</a>
          </Link>
        ),
    },
    {
      title: "To",
      dataIndex: "to",
      render: (to) =>
        to === props.accountId ? (
          ecllipseHash(to)
        ) : (
          <Link href={`/accounts/${to}`}>
            <a>{ecllipseHash(to)}</a>
          </Link>
        ),
    },
    {
      title: "Value",
      dataIndex: "amount",
      render: (amount) => <Balance balance={amount} />,
    },
    {
      title: "Time",
      dataIndex: "blockAt",
      render: (blockAt) => <TimeAgo time={blockAt} />,
    },
    {
      title: "Result",
      dataIndex: "success",
      render: (success) => <ExtrinsicResult success={success} />,
    },
  ];
  return <Table rowKey="extrinsicId" columns={columns} {...props} />;
}
