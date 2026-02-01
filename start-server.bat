@echo off
setlocal

set PORT=8000

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Starting Python http.server on port %PORT%...
  python -m http.server %PORT%
  exit /b %ERRORLEVEL%
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Starting Python (py) http.server on port %PORT%...
  py -m http.server %PORT%
  exit /b %ERRORLEVEL%
)

where npx >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Starting http-server via npx on port %PORT%...
  npx http-server -p %PORT%
  exit /b %ERRORLEVEL%
)

echo No suitable runtime found. Install Python or Node.js, then re-run this script.
exit /b 1
