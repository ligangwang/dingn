param(
  [string]$Project = 'dingn-193716',
  [string]$Region = 'us-central1',
  [string]$Service = 'dingn-web'
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) { throw 'Install the Google Cloud CLI and sign in with gcloud auth login first.' }
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'Website verification failed.' }
gcloud run deploy $Service --source . --project $Project --region $Region --allow-unauthenticated --port 8080 --memory 256Mi --cpu 1 --min-instances 0 --max-instances 2 --timeout 60 --quiet
if ($LASTEXITCODE -ne 0) { throw 'Cloud Run deployment failed.' }
gcloud run services describe $Service --project $Project --region $Region --format 'value(status.url)'
