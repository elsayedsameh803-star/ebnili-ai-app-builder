@echo off
npx tsc --noEmit --skipLibCheck > ts_output.txt 2>&1
echo TSC_EXIT_CODE=%ERRORLEVEL% >> ts_output.txt
