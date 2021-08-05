import BlocksAndEvents from "../components/BlocksAndEvents";
import MainLayout from "../components/MainLayout";

export default function IndexPage() {
  return (
    <BlocksAndEvents />
  );
}

IndexPage.getLayout = (page) => (
  <MainLayout>{page}</MainLayout>
)