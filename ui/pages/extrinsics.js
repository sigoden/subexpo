import { useRouter } from "next/router";
import { useRequest } from "@umijs/hooks";
import MainLayout from "../components/MainLayout";
import SearchForm, { parseQueryForm, stringifyQueryForm } from "../components/SearchForm";
import ExtrinsicTable from "../components/ExtrinsicTable";

async function listExtrinsics(paginatedParams, queryForm) {
  let qs = `current=${paginatedParams.current}&pageSize=${paginatedParams.pageSize}`;
  qs = stringifyQueryForm(qs, queryForm);
    
  return fetch(`/api/extrinsics?${qs}`)
    .then((res) => res.json())
}

export default function ExtrinsicsPage() {
  const router = useRouter();
  const { tableProps } = useRequest(
    paginatedParams => listExtrinsics(paginatedParams, parseQueryForm(router.query)), 
    {
      paginated: true,
      refreshDeps: [router.query],
      defaultPageSize: 20,
    }
  );
  return (
    <div>
      <SearchForm kind="calls" />
      <ExtrinsicTable {...tableProps} />
    </div>
  );
}

ExtrinsicsPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)
