import { Form } from "antd";
import { useFormTable } from "@umijs/hooks";
import MainLayout from "../components/MainLayout";
import SearchForm from "../components/SearchForm";
import ExtrinsicTable from "../components/ExtrinsicTable";

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

export default function ExtrinsicsPage() {
  const [form] = Form.useForm();
  const { tableProps, search } = useFormTable(listExtrinsics, {
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
      <ExtrinsicTable {...tableProps} />
    </div>
  );
}

ExtrinsicsPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)
