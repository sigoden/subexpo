import { useRouter } from "next/router";
import { useRequest } from "@umijs/hooks";
import MainLayout from "../components/MainLayout";
import TransferTable from "../components/TransferTable";

async function listExtrinsics(paginatedParams, accountId) {
  let qs = `current=${paginatedParams.current}&pageSize=${paginatedParams.pageSize}&accountId=${accountId}`;
  return fetch(`/api/transfers?${qs}`)
    .then((res) => res.json())
}

export default function ExtrinsicsPage() {
  const router = useRouter();
  const { tableProps } = useRequest(
    paginatedParams => listExtrinsics(paginatedParams, router.query.accountId), 
    {
      paginated: true,
      refreshDeps: [router.query],
      defaultPageSize: 20,
    }
  );
  return (
    <div>
      <TransferTable {...tableProps} />
    </div>
  );
}

ExtrinsicsPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)
