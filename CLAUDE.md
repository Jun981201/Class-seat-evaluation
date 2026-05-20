# Classroom Management Tool / 课堂管理工具

Flask web app at `app.py` — run with `python app.py` (port 5050).

## Structure

```
app.py                        # Flask routes & API
generators/                   # Excel generation logic
  seating.py                  # Seating chart (7-per-table desks)
  evaluation.py               # Evaluation form generator
  comments.py                 # Auto student comments from grades
  duty.py                     # Duty schedule generator
  template_engine.py          # Shared Excel formatting utilities
templates/index.html          # Frontend (single page)
static/css/style.css
static/js/app.js
evaluation_templates/         # Template .xlsx + templates.json
uploads/                      # Temp uploads (gitignored)
```

## Key rules

- **Desks**: 4 desks, B-C=left, E-F=right. Front rows 10-12, back rows 5-7.
- **Seat grouping**: Each desk side = 3 adjacent seats (same column, consecutive rows). Seats numbered 1-2-3, 4-5-6, 7 per desk.
- **≤24 students**: 6 per desk (no end seat), front desks filled first.
- **>24 students**: 7 per desk (with end seat B8/E8/B9/E9), front desks filled first.
- **Gender modes**: `random` (shuffle), `gender_alternate` (adjacent pairs different), `same_gender` (blocks of 3 same gender).
- **Templates**: Upload .xlsx → parsed via `parse_template_xlsx()` → saved to `evaluation_templates/templates.json`.
- **Student list**: Weekly roster .xls/.xlsx parsed via `parse_weekly_student_list()` — detects classes, projects, footer text.
- **Grades**: `upload-grades` endpoint reads grades file, auto-generates comments per student.

## Dependencies

flask, openpyxl, xlrd, werkzeug

## Git remote

git@github.com:Jun981201/Class-seat-evaluation.git
