import { useRouter } from "next/router";
import { useAntdTable } from "ahooks";
import MainLayout from "../components/MainLayout";
import SearchForm, {
  parseQueryForm,
  stringifyQueryForm,
} from "../components/SearchForm";
import EventTable from "../components/EventTable";

async function listEvents(paginatedParams, queryForm) {
  let qs = `current=${paginatedParams.current}&pageSize=${paginatedParams.pageSize}`;
  qs = stringifyQueryForm(qs, queryForm);

  return fetch(`/api/events?${qs}`).then((res) => res.json());
}

export default function EventsPage() {
  const router = useRouter();
  const { tableProps } = useAntdTable(
    (paginatedParams) =>
      listEvents(paginatedParams, parseQueryForm(router.query)),
    {
      refreshDeps: [router.query],
      defaultPageSize: 20,
    }
  );
  return (
    <div>
      <SearchForm kind="events" />
      <EventTable {...tableProps} />
    </div>
  );
}

EventsPage.getLayout = (page) => <MainLayout>{page}</MainLayout>;
