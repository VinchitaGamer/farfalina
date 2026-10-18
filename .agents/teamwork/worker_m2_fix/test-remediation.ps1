# test-remediation.ps1
# Automated test harness for verifying Reviewer 1 remediation in scripts/setup-cloudflare-tunnel.ps1

$targetScript = "c:\Users\Lenovo\Desktop\floreria\scripts\setup-cloudflare-tunnel.ps1"
$allPassed = $true

# Ensure UTF-8 with BOM for PowerShell 5.1 compatibility
$rawBytes = [System.IO.File]::ReadAllBytes($targetScript)
Write-Host "BOM check: First 3 bytes are $($rawBytes[0]), $($rawBytes[1]), $($rawBytes[2])" -ForegroundColor Gray
if ($rawBytes[0] -ne 0xEF -or $rawBytes[1] -ne 0xBB -or $rawBytes[2] -ne 0xBF) {
    Write-Host "Saving with UTF-8 BOM..." -ForegroundColor Yellow
    $text = [System.IO.File]::ReadAllText($targetScript, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($targetScript, $text, [System.Text.Encoding]::UTF8)
    Write-Host "File rewritten with UTF-8 BOM." -ForegroundColor Green
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " RUNNING REMEDIATION VERIFICATION SUITE" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Test 1: Parser Syntax Check
# ---------------------------------------------------------------------------
Write-Host "[Test 1] Parsing script for syntax errors..." -ForegroundColor Yellow
$parseErrors = $null
$tokens = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($targetScript, [ref]$tokens, [ref]$parseErrors)

if ($parseErrors.Count -eq 0) {
    Write-Host " [PASS] Script syntax is 100% valid. (0 errors)" -ForegroundColor Green
} else {
    Write-Host " [FAIL] Found $($parseErrors.Count) syntax errors:" -ForegroundColor Red
    foreach ($err in $parseErrors) {
        Write-Host "   - Line $($err.Extent.StartLineNumber): $($err.Message)" -ForegroundColor Red
    }
    $allPassed = $false
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 2: NonInteractive without Token (Bug 2 - Hang prevention & Exit code 1)
# ---------------------------------------------------------------------------
Write-Host "[Test 2] Testing -NonInteractive without -Token..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$proc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$targetScript`" -Action run -NonInteractive" `
    -Wait -PassThru -NoNewWindow -RedirectStandardOutput "test_t2_out.txt" -RedirectStandardError "test_t2_err.txt"

$sw.Stop()
$t2Output = if (Test-Path "test_t2_out.txt") { Get-Content "test_t2_out.txt" -Raw } else { "" }
Remove-Item "test_t2_out.txt", "test_t2_err.txt" -Force -ErrorAction SilentlyContinue

Write-Host " Execution time: $($sw.ElapsedMilliseconds) ms" -ForegroundColor Gray
Write-Host " Exit code     : $($proc.ExitCode)" -ForegroundColor Gray

if ($sw.ElapsedMilliseconds -lt 10000 -and $proc.ExitCode -eq 1 -and $t2Output -match "NonInteractive") {
    Write-Host " [PASS] Script exited immediately with exit code 1 without hanging." -ForegroundColor Green
} else {
    Write-Host " [FAIL] Expected immediate exit with code 1 and NonInteractive message." -ForegroundColor Red
    Write-Host " Output was: $t2Output" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 3: Path resolution in Ensure-Elevation (Bug 1 - No empty -File "")
# ---------------------------------------------------------------------------
Write-Host "[Test 3] Testing script path resolution inside function..." -ForegroundColor Yellow
$scriptContent = Get-Content $targetScript -Raw
if ($scriptContent -match '\$scriptPath\s*=\s*if\s*\(\$PSCommandPath\)') {
    Write-Host " [PASS] Ensure-Elevation resolves `$scriptPath using `$PSCommandPath fallback chain." -ForegroundColor Green
} else {
    Write-Host " [FAIL] `$scriptPath resolution pattern not found in script." -ForegroundColor Red
    $allPassed = $false
}

if ($scriptContent -match '-File\s+`"\$scriptPath`"') {
    Write-Host " [PASS] -File argument in Ensure-Elevation passes `"`$scriptPath`"`." -ForegroundColor Green
} else {
    Write-Host " [FAIL] -File argument does not pass `"`$scriptPath`"`." -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# ---------------------------------------------------------------------------
# Test 4: Exit Code Propagation (Finding 3 - Invalid Token Failure)
# ---------------------------------------------------------------------------
Write-Host "[Test 4] Testing exit code propagation on cloudflared failure..." -ForegroundColor Yellow
$proc4 = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$targetScript`" -Action run -NonInteractive -Token `"dummy_invalid_token_123`"" `
    -Wait -PassThru -NoNewWindow -RedirectStandardOutput "test_t4_out.txt" -RedirectStandardError "test_t4_err.txt"

$t4Output = if (Test-Path "test_t4_out.txt") { Get-Content "test_t4_out.txt" -Raw } else { "" }
Remove-Item "test_t4_out.txt", "test_t4_err.txt" -Force -ErrorAction SilentlyContinue

Write-Host " Exit code: $($proc4.ExitCode)" -ForegroundColor Gray
if ($proc4.ExitCode -ne 0) {
    Write-Host " [PASS] Script propagated non-zero exit code ($($proc4.ExitCode)) when cloudflared failed." -ForegroundColor Green
} else {
    Write-Host " [FAIL] Script returned exit code 0 despite cloudflared failure." -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host "============================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host " ALL REMEDIATION VERIFICATION TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
} else {
    Write-Host " SOME VERIFICATION TESTS FAILED!" -ForegroundColor Red
}
Write-Host "============================================================" -ForegroundColor Cyan

if (-not $allPassed) {
    exit 1
}
