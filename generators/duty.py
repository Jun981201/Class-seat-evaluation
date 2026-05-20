"""Duty/cleaning schedule generator."""
import random


class DutyGenerator:
    """Generate weekly duty/cleaning schedules."""

    @staticmethod
    def generate(students, group_size=5, weeks=1, mode='rotate'):
        """
        Generate duty schedule. Each student does duty exactly once per week.
        Monday has fewer students, Tuesday-Friday evenly distributed.

        Args:
            students: list of dicts with id, name
            group_size: ignored (kept for API compat)
            weeks: number of weeks to generate
            mode: 'rotate' or 'random' (both give same no-repeat result)

        Returns:
            dict: {weekday: [student_ids]} or list of dicts for multiple weeks
        """
        student_ids = [s.get('id', '') for s in students]
        if not student_ids:
            return {}

        all_weeks = []
        for w in range(weeks):
            shuffled = list(student_ids)
            random.shuffle(shuffled)

            n = len(shuffled)
            monday = max(1, n // 6)
            remaining = n - monday
            per_other = remaining // 4
            extra = remaining % 4

            schedule = {}
            weekdays = ['一', '二', '三', '四', '五']
            idx = 0

            schedule['一'] = shuffled[idx:idx + monday]
            idx += monday

            for di in range(4):
                count = per_other + (1 if di < extra else 0)
                schedule[weekdays[di + 1]] = shuffled[idx:idx + count]
                idx += count

            all_weeks.append(schedule)

        return all_weeks[0] if weeks == 1 else all_weeks
