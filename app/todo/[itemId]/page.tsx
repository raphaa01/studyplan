import { TodoFocusMode } from "@/components/todo-focus-mode";

export default async function TodoFocusPage({ params }: PageProps<"/todo/[itemId]">) {
  const { itemId } = await params;
  return <TodoFocusMode itemId={itemId} />;
}
