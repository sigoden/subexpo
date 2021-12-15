import { useAntdTable } from "ahooks";
import BlockTable from "../components/BlockTable";
import MainLayout from "../components/MainLayout";

async function listExtrinsics(paginatedParams) {
  return fetch(
    `/api/blocks?current=${paginatedParams.current}&pageSize=${paginatedParams.pageSize}`
  ).then((res) => res.json());
}

export default function BlocksPage() {
  const { tableProps } = useAntdTable((params) => listExtrinsics(params), {
    defaultPageSize: 20,
  });
  return <BlockTable {...tableProps} />;
}

BlocksPage.getLayout = (page) => <MainLayout>{page}</MainLayout>;
