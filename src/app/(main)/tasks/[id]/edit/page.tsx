import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { TaskForm } from "@/components/task-form";
import { serializeTask } from "@/lib/api/serialize-task";
import { getTaskById } from "@/lib/services/task-service";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskById(id);
  if (!task) notFound();

  return (
    <div>
      <Link href={`/tasks/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-text-muted">
        <ArrowLeftIcon width={18} height={18} />
        Back
      </Link>
      <h1 className="mb-5 text-2xl font-extrabold">Edit task</h1>
      <TaskForm task={serializeTask(task)} />
    </div>
  );
}
