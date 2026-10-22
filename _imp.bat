@echo off
powershell -NoProfile -Command "Get-Content -Path 'c:\Users\Fast\OneDrive\Desktop\ebnily\src\components\GitHubImporter.tsx' | Select-Object -Skip 95 -First 38 | Out-File -Encoding utf8 -Width 400 c:\Users\Fast\OneDrive\Desktop\ebnily\_imp.txt"
