# Classroom Management Tool / 课堂管理工具

Flask-based classroom management web application for teachers.

## Features / 功能

- **Seating Chart** — Auto-arrange students at 7-per-table desks, front-first when fewer than 24 students
- **Evaluation Forms** — Generate evaluation sheets from configurable templates
- **Duty Schedule** — Auto-generate weekly duty rosters
- **Auto Comments** — Generate grade-based student comments from score imports

## Arrange Modes / 排列方式

| Mode | Description |
|------|-------------|
| Random | Fully random shuffle |
| Gender Alternate | Adjacent students have different genders |
| Same Gender | Groups of 3 adjacent students share the same gender |

## Tech Stack

- Python 3 / Flask
- openpyxl (Excel generation)
- xlrd (legacy .xls parsing)

## Usage

```bash
pip install flask openpyxl xlrd
python app.py
# Open http://127.0.0.1:5050
```

## Project Structure

```
seating_tool/
├── app.py                  # Flask application
├── generators/             # Excel generators
│   ├── seating.py          # Seating chart
│   ├── evaluation.py       # Evaluation forms
│   ├── duty.py             # Duty schedule
│   ├── comments.py         # Auto comments
│   └── template_engine.py  # Shared Excel utils
├── templates/              # HTML templates
├── static/                 # CSS/JS
└── evaluation_templates/   # Template configs
```
