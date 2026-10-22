@echo off
REM Cleanup temporary files created during development
cd /d c:\Users\Fast\OneDrive\Desktop\ebnily
del /q test_simple.txt 2>nul
del /q ts_output.txt 2>nul
del /q ts_errors.txt 2>nul
del /q ts_out.txt 2>nul
del /q ts_err.txt 2>nul
del /q build_result.txt 2>nul
del /q build_output.txt 2>nul
del /q check_types_output.txt 2>nul
del /q check.bat 2>nul
del /q check_err.txt 2>nul
del /q check_out.txt 2>nul
del /q run_check.bat 2>nul
del /q tsc_output.txt 2>nul
del /q tsc_errors.txt 2>nul
del /q ts_exit.txt 2>nul
del /q ts_output_final.txt 2>nul
del /q test_bg.txt 2>nul
echo Cleanup done.

REM Type check
echo === Running type check ===
npx tsc --noEmit --skipLibCheck
if %ERRORLEVEL% NEQ 0 (
    echo TYPE CHECK FAILED
    pause
    exit /b 1
)

REM Build
echo === Running build ===
npx vite build
if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED
    pause
    exit /b 1
)

echo === All checks passed ===

REM Git commit and push
git add -A
git status
git commit -m "Add GitHub Connect button to import repo files (site UI + Studio Ebneely)"
git push

echo === Git operations complete ===
pause
