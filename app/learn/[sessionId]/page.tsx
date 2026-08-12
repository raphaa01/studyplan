import { LearningMode } from "@/components/learning-mode";

export default async function LearningSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <LearningMode sessionId={sessionId} />;
}
