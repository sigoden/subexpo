import { useRouter } from "next/router";
import { useRequest } from "@umijs/hooks";
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
  const { tableProps } = useRequest(
    (paginatedParams) =>
      listEvents(paginatedParams, parseQueryForm(router.query)),
    {
      paginated: true,
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
