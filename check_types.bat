@echo off
cd /d c:\Users\Fast\OneDrive\Desktop\ebnily
npx tsc --noEmit --skipLibCheck > check_types_output.txt 2>&1
echo TSC_EXIT_CODE=%ERRORLEVEL% >> check_types_output.txt
