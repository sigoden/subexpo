import prisma from "../../lib/prisma";
import MainLayout from "../../components/MainLayout";

export async function getServerSideProps({ params }) {
  const { id } = params;
  if (typeof id === "string")  {
    const blockNum = parseInt(id);
    const where =  blockNum ? { blockNum } : { blockHash: id }
    const block = await prisma.chainBlock.findFirst({ where });
    if (block) return { props: { block } }
  }
  return { notFound: true };
}

export default function BlockPage(props) {
  return <div>{JSON.stringify(props.block, null, 2)}</div>
}

BlockPage.getLayout = (page) => (
  <MainLayout noSearch>{page}</MainLayout>
)
