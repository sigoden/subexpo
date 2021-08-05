import { Table, Form } from "antd";
import Link from "next/link";
import { useFormTable } from "@umijs/hooks";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { ecllipseHash, formatTimeAgo } from "../lib/utils";
import MainLayout from "../components/MainLayout";
import SearchForm from "../components/SearchForm";

async function listExtrinsics(paginatedParams, queryForm) {

  let qs = `current=${paginatedParams.current}&pageSize=${paginatedParams.pageSize}`;
  if (queryForm.module?.length) {
    qs += `&section=${queryForm.module[0]}`;
    if (queryForm.module[1]) {
      qs += `&method=${queryForm.module[1]}`;
    }
  }
  if (queryForm.date?.length) {
    qs += `&startDate=${Math.floor(queryForm.date[0].toDate().getTime() / 1000)}`;
    qs += `&endDate=${Math.ceil(queryForm.date[1].toDate().getTime() / 1000)}`;
  }
    
  return fetch(`/api/extrinsics?${qs}`)
    .then((res) => res.json())
}

const columns = [
  {
    title: "Extrinisic ID",
    dataIndex: "extrinsicId",
    render: (extrinsicId) => <Link href={`/extrinsic/${extrinsicId}`}><a>{extrinsicId}</a></Link>
  },
  {
    title: "Block",
    dataIndex: 'blockNum',
    render: blockNum => <Link href={`/block/${blockNum}`}><a>{blockNum}</a></Link>
  },
  {
    title: "Extrinisic hash",
    dataIndex: "extrinsicHash",
    render: hash => <Link href={`/extrinsic/${hash}`}><a>{ecllipseHash(hash)}</a></Link>,
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

export default function ExtrinsicsPage() {
  const [form] = Form.useForm();
  const { tableProps, params, search } = useFormTable(listExtrinsics, {
    paginated: true,
    defaultParams: [
      { current: 1, pageSize: 20 },
      { module: [], date: [] }
    ],
    form,
  });
  return (
    <div>
      <SearchForm kind="calls" form={form} {...search} />
      <Table columns={columns} rowKey="extrinsicId" {...tableProps} />
    </div>
  );
}

ExtrinsicsPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)
