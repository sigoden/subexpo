import { Table } from "antd";
import Link from "next/link";
import { ecllipseHash } from "../lib/utils";
import TimeAgo from "./TimeAgo";
import Args from "./Args";
import ExtrinsicResult from "./ExtrinsicResult";
import ExpandIcon from "./ExpandIcon";

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
    title: "Account",
    dataIndex: "accountId",
    render: (accountId) =>
      accountId ? (
        <Link href={`/accounts/${accountId}`}>
          <a>{ecllipseHash(accountId)}</a>
        </Link>
      ) : (
        "-"
      ),
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
  {
    title: "Action",
    key: "action",
    dataIndex: "section",
    render: (_, record) => {
      const { section, method } = record;
      return (
        <Link href={`/extrinsics?section=${section}&method=${method}`}>
          <a>{`${section}(${method})`}</a>
        </Link>
      );
    },
  },
];

export default function ExtrinsicTable(props) {
  return (
    <Table
      columns={columns.filter(
        (v) => (props.noColumns || []).indexOf(v.dataIndex) === -1
      )}
      rowKey="extrinsicId"
      expandIconColumnIndex={Number.MAX_SAFE_INTEGER}
      expandIcon={(props) =>
        props.record.args?.length > 0 ? <ExpandIcon {...props} /> : null
      }
      expandable={{
        expandedRowRender: (record) => (
          <div className="args">
            <Args args={record.args} />
          </div>
        ),
      }}
      {...props}
    />
  );
}
