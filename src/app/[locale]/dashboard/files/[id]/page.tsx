import { FileViewerPage } from "@/components/file-viewer-page";

export default function FilePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  return <FileViewerPage params={params} />;
}