@echo off
chcp 65001 >nul
cd /d "c:\Users\Fast\OneDrive\Desktop\ebnily"
echo ============================================================
echo   EBNILI  -  Push your code to BOTH GitHub repositories
echo ============================================================
echo.
echo [0] Current state:
git --no-pager status -s
git --no-pager log --oneline -3 --decorate
echo.
echo [1] Saving your local work...
git add -A
git commit -m "chore: sync user dashboard + i18n fixes" 2>nul || echo    (nothing new to commit - existing commits will be pushed)
echo.
echo [2] Pushing to ORIGIN  (ebnili-ai-app-builder)...
git fetch origin
git push origin main
echo.
echo [3] Pushing to EBNILY  (ebnily)...
git fetch ebnily
echo    Showing remote tip so you can confirm it is in sync:
git --no-pager log --oneline -3 ebnily/main
echo    If the push is REJECTED (non-fast-forward), it retries with force.
git push ebnily main 2>nul || git push ebnily main --force-with-lease
echo.
echo ============================================================
echo   DONE.
echo   If you saw "up-to-date" or "main -> main" above, it worked.
echo   NEXT STEP: open Vercel and click REDEPLOY so the site
echo   rebuilds from this code, then SIGN IN and open the sidebar.
echo ============================================================
pause
