import { createClient } from "@/lib/supabase/client";
import type { StudyData } from "@/types/study";
import type { Json } from "@/types/database";

export class SupabaseStudyRepository {
  private readonly client = createClient();

  constructor(private readonly userId: string) {}

  async getAll(): Promise<StudyData | null> {
    const { data, error } = await this.client
      .from("study_data")
      .select("data")
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error) throw new Error(`Cloud-Daten konnten nicht geladen werden: ${error.message}`);
    return data?.data ? data.data as unknown as StudyData : null;
  }

  async saveAll(studyData: StudyData): Promise<void> {
    const { error } = await this.client
      .from("study_data")
      .upsert({ user_id: this.userId, data: studyData as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) throw new Error(`Cloud-Daten konnten nicht gespeichert werden: ${error.message}`);
  }
}
