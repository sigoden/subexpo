import { Form } from "antd";
import { useFormTable } from "@umijs/hooks";
import MainLayout from "../components/MainLayout";
import SearchForm from "../components/SearchForm";
import EventTable from "../components/EventTable";

async function listEvents(paginatedParams, queryForm) {

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
    
  return fetch(`/api/events?${qs}`)
    .then((res) => res.json())
}

export default function EventsPage() {
  const [form] = Form.useForm();
  const { tableProps, search } = useFormTable(listEvents, {
    paginated: true,
    defaultParams: [
      { current: 1, pageSize: 20 },
      { module: [], date: [] }
    ],
    form,
  });
  return (
    <div>
      <SearchForm kind="events" form={form} {...search} />
      <EventTable {...tableProps} />
    </div>
  );
}

EventsPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)
