import { requireChatGPTUser } from "../../../chatgpt-auth";
import PackageApp from "../../../components/PackageApp";

export const dynamic = "force-dynamic";

export default async function PackagePage({ params }: { params: Promise<{ packageCode: string }> }) {
  const { packageCode } = await params;
  const decoded = decodeURIComponent(packageCode);
  await requireChatGPTUser(`/workshop/packages/${encodeURIComponent(decoded)}`);
  return <PackageApp packageCode={decoded} />;
}
