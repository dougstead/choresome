import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { TaskForm } from "@/components/task-form";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string }>;
}) {
  const { areaId } = await searchParams;

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-text-muted">
        <ArrowLeftIcon width={18} height={18} />
        Back
      </Link>
      <h1 className="mb-5 text-2xl font-extrabold">New task</h1>
      <TaskForm defaultAreaId={areaId} />
    </div>
  );
}
