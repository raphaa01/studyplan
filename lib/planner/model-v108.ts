/** Browser contract for QECore v1.08 candidates. This file does not promote a model. */
export const QECORE_V108 = {
  name: "QECore v1.08",
  schemaVersion: "3.0",
  rewardVersion: "3.0",
  slotMinutes: 30,
  maxTargets: 12,
  targetFeatures: 24,
  globalFeatures: 16,
  targetPresentIndex: 0,
  expectedSha256: null as string | null,
  targetFeatureOrder: [
    "present", "isExam", "isRoutine", "hasDeadline", "deadlineDays/30",
    "remainingNeedMinutes/900", "investedMinutes/900", "difficulty/10", "importance/10",
    "desiredBlockSlots/4", "spacingPreference", "interleavingPreference", "preferredPhase",
    "retrievalIntensity", "weeklySessions/7", "weeklyFulfilled/weeklySessions",
    "remainingWeekSlots/28", "lastGapDays/7", "distinctStudyDays/7",
    "examRoutineCredit/weeklySessions", "allowedNow", "feedbackDifficulty",
    "feedbackConfidence", "isFlexible",
  ] as const,
  globalFeatureOrder: [
    "weekday/6", "positionInWeek", "slotPosition", "remainingWeekSlotsRatio",
    "routineDeficit/12", "dailyLoadSlots/6", "focusRunSlots/6", "examBurdenMinutes/1800",
    "flexibleShare", "mandatoryShare", "minuteOfDay/1440", "previousWasIdle",
    "curriculumLevel/5", "targetCount/12", "studiedSlotRatio", "isContiguous",
  ] as const,
  actionMapping: "0 = idle; 1..12 = target row + 1; missing/disallowed rows are masked false",
  fallbackConditions: ["missing model", "hash mismatch", "shape mismatch", "non-finite output", "masked action", "runtime error"],
} as const;

export type QECoreObservation = {
  targets: Float32Array;
  globals: Float32Array;
  actionMask: Uint8Array;
};

export function validateQECoreObservation(observation: QECoreObservation): boolean {
  return observation.targets.length === QECORE_V108.maxTargets * QECORE_V108.targetFeatures
    && observation.globals.length === QECORE_V108.globalFeatures
    && observation.actionMask.length === QECORE_V108.maxTargets + 1
    && observation.actionMask[0] === 1
    && [...observation.targets].every(Number.isFinite)
    && [...observation.globals].every(Number.isFinite);
}
