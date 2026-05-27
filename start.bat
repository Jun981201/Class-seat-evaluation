@echo off
chcp 65001 >nul
cd /d "e:\vibe coding\classseat"
start "Flask Server" /min python app.py
timeout /t 3 /nobreak >nul
start "" http://localhost:5051
