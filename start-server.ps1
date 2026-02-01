$ErrorActionPreference = "Stop"

$port = 8000

if (Get-Command python -ErrorAction SilentlyContinue) {
  Write-Host "Starting Python http.server on port $port..."
  python -m http.server $port
  exit $LASTEXITCODE
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  Write-Host "Starting Python (py) http.server on port $port..."
  py -m http.server $port
  exit $LASTEXITCODE
}

if (Get-Command npx -ErrorAction SilentlyContinue) {
  Write-Host "Starting http-server via npx on port $port..."
  npx http-server -p $port
  exit $LASTEXITCODE
}

Write-Host "No suitable runtime found. Install Python or Node.js, then re-run this script."
exit 1
