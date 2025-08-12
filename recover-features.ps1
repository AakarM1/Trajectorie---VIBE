# Feature Recovery Script
# This script recovers lost authentication context files from the stash

Write-Host "🔄 Starting Feature Recovery..." -ForegroundColor Green

# Get the stash reference
$stashRef = "stash@{0}"

Write-Host "📋 Extracting auth context files from stash..." -ForegroundColor Yellow

# Create a temporary directory
if (!(Test-Path "temp_recovery")) {
    New-Item -ItemType Directory -Path "temp_recovery" -Force
}

# Extract files using git show
$files = @(
    "src/contexts/auth-context-backup.tsx",
    "src/contexts/auth-context-database.tsx", 
    "src/contexts/auth-context-firestore.tsx"
)

foreach ($file in $files) {
    Write-Host "Extracting $file..." -ForegroundColor Cyan
    try {
        $content = git show "${stashRef}:${file}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $content | Out-File -FilePath "temp_recovery\$(Split-Path $file -Leaf)" -Encoding UTF8
            Write-Host "✅ Successfully extracted $file" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Could not extract $file - may not exist in stash" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Error extracting $file`: $_" -ForegroundColor Red
    }
}

Write-Host "✅ Feature recovery completed!" -ForegroundColor Green
Write-Host "🔍 Check temp_recovery folder for extracted files" -ForegroundColor Cyan
