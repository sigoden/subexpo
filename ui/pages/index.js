import BlocksAndEvents from "../components/BlocksAndEvents";
import MainLayout from "../components/MainLayout";
import { getLatestBLocksAndEvents } from "../lib/prisma";

export async function getServerSideProps() {
  const { blocks, events } = await getLatestBLocksAndEvents();
  return { props: { blocks, events }};
}

export default function IndexPage(props) {
  return (
    <BlocksAndEvents {...props} />
  );
}

IndexPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)