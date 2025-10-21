@echo off
echo Starting Poetry Analysis Tool...
echo Opening browser at http://localhost:8000
echo Press Ctrl+C to stop
start http://localhost:8000
python -m http.server 8000
