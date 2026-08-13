from __future__ import annotations

from .generator import windows_to_slots
from .schemas import Exam, Situation, TimeWindow


def _case(case_id: str, name: str, description: str, exams: list[Exam], windows: list[TimeWindow]) -> dict[str, object]:
    situation = Situation(
        id=case_id, exams=exams, windows=windows, slots=windows_to_slots(windows),
        curriculum_level=5, seed=7000 + int(case_id.split("-")[-1]),
    )
    return {"id": case_id, "name": name, "description": description, "situation": situation.model_dump(mode="json")}


def challenge_cases() -> list[dict[str, object]]:
    return [
        _case("case-1", "Klausur morgen", "Maximal schwere und wichtige Mathematik-Klausur, nur zwei Stunden.",
              [Exam(id="math", subject="Mathematik", kind="exam", days_until=1, difficulty=10, importance=10, estimated_need_minutes=480)],
              [TimeWindow(day=0, start_minute=16 * 60, end_minute=18 * 60)]),
        _case("case-2", "Fünf in sieben Tagen", "Konkurrierende Deadlines mit knapper Nachmittagszeit.",
              [Exam(id=f"e{i}", subject=s, kind="exam" if i % 2 else "test", days_until=i + 2, difficulty=4 + i, importance=5 + (i % 4), estimated_need_minutes=180 + i * 30)
               for i, s in enumerate(["Mathematik", "Deutsch", "Biologie", "Geschichte", "Englisch"])],
              [TimeWindow(day=d, start_minute=16 * 60, end_minute=18 * 60) for d in (0, 1, 3, 5)]),
        _case("case-3", "Dringend oder wichtig", "Leichter Test morgen gegen wichtige schwere Klausur in zehn Tagen.",
              [Exam(id="quick", subject="Geografie", kind="test", days_until=1, difficulty=2, importance=2, estimated_need_minutes=60),
               Exam(id="major", subject="Physik", kind="exam", days_until=10, difficulty=9, importance=10, estimated_need_minutes=480)],
              [TimeWindow(day=d, start_minute=16 * 60, end_minute=18 * 60) for d in (0, 2, 4, 6, 8)]),
        _case("case-4", "Sehr viel freie Zeit", "Prüft, ob unnötige Lernzeit auch frei bleiben kann.",
              [Exam(id="a", subject="Deutsch", kind="test", days_until=7, difficulty=3, importance=4, estimated_need_minutes=120),
               Exam(id="b", subject="Englisch", kind="test", days_until=9, difficulty=4, importance=5, estimated_need_minutes=150)],
              [TimeWindow(day=d, start_minute=10 * 60, end_minute=18 * 60) for d in range(7)]),
        _case("case-5", "Extrem wenig Zeit", "Drei wichtige Prüfungen konkurrieren um 90 Minuten.",
              [Exam(id=f"s{i}", subject=s, kind="exam", days_until=3 + i, difficulty=8, importance=8 + i, estimated_need_minutes=360)
               for i, s in enumerate(["Chemie", "Mathematik", "Deutsch"])],
              [TimeWindow(day=0, start_minute=17 * 60, end_minute=18 * 60 + 30)]),
        _case("case-6", "Gleicher Prüfungstag", "Zwei verschieden gewichtete Prüfungen am selben Tag.",
              [Exam(id="x", subject="Biologie", kind="exam", days_until=5, difficulty=8, importance=7, estimated_need_minutes=300),
               Exam(id="y", subject="Geschichte", kind="exam", days_until=5, difficulty=5, importance=9, estimated_need_minutes=240)],
              [TimeWindow(day=d, start_minute=16 * 60, end_minute=18 * 60) for d in range(5)]),
        _case("case-7", "Langfristig schwer", "Schwere Klausur in 14 Tagen mit kleinen Tests davor.",
              [Exam(id="main", subject="Mathematik", kind="exam", days_until=14, difficulty=10, importance=10, estimated_need_minutes=600),
               Exam(id="t1", subject="Politik", kind="test", days_until=3, difficulty=3, importance=4, estimated_need_minutes=90),
               Exam(id="t2", subject="Englisch", kind="test", days_until=7, difficulty=4, importance=5, estimated_need_minutes=120)],
              [TimeWindow(day=d, start_minute=16 * 60, end_minute=18 * 60) for d in (0, 1, 3, 5, 7, 9, 11, 13)]),
    ]

