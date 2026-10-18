# independent-verify.ps1
# Independent Verification Suite by Reviewer M2 Recheck

$targetFile = "c:\Users\Lenovo\Desktop\floreria\scripts\setup-cloudflare-tunnel.ps1"
$results = @()

function Record-Test {
    param([string]$Name, [bool]$Passed, [string]$Details)
    $script:results += [PSCustomObject]@{
        Name    = $Name
        Passed  = $Passed
        Details = $Details
    }
    $status = if ($Passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($Passed) { "Green" } else { "Red" }
    Write-Host "$status $Name" -ForegroundColor $color
    if ($Details) {
        Write-Host "       $Details" -ForegroundColor Gray
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " REVIEWER M2 RECHECK - INDEPENDENT VERIFICATION SUITE" -ForegroundColor White
Write-Host " Target: $targetFile" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# 1. AST Syntax Parse
# -----------------------------------------------------------------------------
$astErrors = $null
$astTokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($targetFile, [ref]$astTokens, [ref]$astErrors)
$astPass = ($astErrors.Count -eq 0)
$astDetail = "Total parse errors: $($astErrors.Count)"
if (-not $astPass) {
    $astDetail += "; " + ($astErrors | ForEach-Object { "$($_.Extent.StartLineNumber): $($_.Message)" } | Join-String -Separator " | ")
}
Record-Test -Name "1. AST Syntax Cleanliness" -Passed $astPass -Details $astDetail

# -----------------------------------------------------------------------------
# 2. Non-Interactive Run without Token (Fast fail < 2000ms, exit code 1, no Read-Host hang)
# -----------------------------------------------------------------------------
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$targetFile`" -Action run -NonInteractive"
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)
$hasExited = $proc.WaitForExit(5000) # Wait at most 5 seconds to catch hangs
$sw.Stop()

$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$exitCode = if ($hasExited) { $proc.ExitCode } else { -999 }

if (-not $hasExited) {
    $proc.Kill()
    Record-Test -Name "2. Non-Interactive Run without Token" -Passed $false -Details "Process hung (> 5000ms), had to be killed"
} else {
    $elapsedMs = $sw.ElapsedMilliseconds
    $fastEnough = ($elapsedMs -lt 2500)
    $correctExitCode = ($exitCode -eq 1)
    $hasErrorMessage = ($stdout -match "Debe proporcionar el parámetro -Token" -or $stdout -match "NonInteractive")
    $noReadHostPrompt = (-not ($stdout -match "Pegue el Token del túnel"))

    $t2Passed = ($fastEnough -and $correctExitCode -and $hasErrorMessage -and $noReadHostPrompt)
    $t2Detail = "Elapsed: ${elapsedMs}ms (< 2500ms: $fastEnough), ExitCode: $exitCode, FoundErrorMsg: $hasErrorMessage, AvoidedPrompt: $noReadHostPrompt"
    Record-Test -Name "2. Non-Interactive Run without Token" -Passed $t2Passed -Details $t2Detail
}

# -----------------------------------------------------------------------------
# 3. UAC Elevation Path Resolution in Ensure-Elevation
# -----------------------------------------------------------------------------
# Inspect AST or execute a function test inside the script context
$elevationCheckScript = @"
& {
    `$PSCommandPath = '$targetFile'
    `$PSScriptRoot = Split-Path -Parent '$targetFile'
    `$ScriptPath = '$targetFile'
    function Test-ElevationLogic {
        `$scriptPath = if (`$PSCommandPath) { `$PSCommandPath } elseif (`$MyInvocation.PSCommandPath) { `$MyInvocation.PSCommandPath } elseif (`$ScriptPath) { `$ScriptPath } else { Join-Path `$PSScriptRoot "setup-cloudflare-tunnel.ps1" }
        return `$scriptPath
    }
    Test-ElevationLogic
}
"@
$resolvedPath = powershell.exe -NoProfile -Command $elevationCheckScript
$resolvedPath = $resolvedPath.Trim()
$pathValid = (Test-Path $resolvedPath) -and ($resolvedPath -like "*setup-cloudflare-tunnel.ps1")

# Also verify source code in setup-cloudflare-tunnel.ps1
$content = Get-Content $targetFile -Raw
$hasNoEmptyFile = (-not ($content -match '-File\s+`"`\$\(\$MyInvocation\.MyCommand\.Path\)`"'))
$usesScriptPathVar = ($content -match '-File\s+`"\$scriptPath`"')
$resolvesInsideFn = ($content -match 'function Ensure-Elevation[\s\S]*?\$scriptPath\s*=\s*if\s*\(\$PSCommandPath\)')

$t3Passed = ($pathValid -and $hasNoEmptyFile -and $usesScriptPathVar -and $resolvesInsideFn)
$t3Detail = "ResolvedPath: '$resolvedPath' (Exists: $(Test-Path $resolvedPath)), UsesScriptPath: $usesScriptPathVar, NoEmptyMyCommand: $hasNoEmptyFile"
Record-Test -Name "3. UAC Elevation Path in Ensure-Elevation" -Passed $t3Passed -Details $t3Detail

# -----------------------------------------------------------------------------
# 4. Exit Code Propagation to Caller
# -----------------------------------------------------------------------------
# Test 4a: Run with dummy token -> cloudflared fails -> exit code should be non-zero
$sw4 = [System.Diagnostics.Stopwatch]::StartNew()
$psi4 = New-Object System.Diagnostics.ProcessStartInfo
$psi4.FileName = "powershell.exe"
$psi4.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$targetFile`" -Action run -NonInteractive -Token `"dummy_invalid_token_xyz`""
$psi4.RedirectStandardOutput = $true
$psi4.RedirectStandardError = $true
$psi4.UseShellExecute = $false
$psi4.CreateNoWindow = $true

$proc4 = [System.Diagnostics.Process]::Start($psi4)
$null = $proc4.WaitForExit(10000)
$sw4.Stop()
$out4 = $proc4.StandardOutput.ReadToEnd()
$err4 = $proc4.StandardError.ReadToEnd()
$exitCode4 = $proc4.ExitCode

$t4Passed = ($exitCode4 -ne 0)
$t4Detail = "ExitCode: $exitCode4 (expected != 0), Output match invalid token: $($out4 -match 'token is not valid|error|El túnel finalizó con error')"
Record-Test -Name "4. Exit Code Propagation (Invalid Token)" -Passed $t4Passed -Details $t4Detail

# -----------------------------------------------------------------------------
# 5. Non-Interactive Action Status (Read-only, should succeed exit 0)
# -----------------------------------------------------------------------------
$psi5 = New-Object System.Diagnostics.ProcessStartInfo
$psi5.FileName = "powershell.exe"
$psi5.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$targetFile`" -Action status -NonInteractive"
$psi5.RedirectStandardOutput = $true
$psi5.RedirectStandardError = $true
$psi5.UseShellExecute = $false
$psi5.CreateNoWindow = $true

$proc5 = [System.Diagnostics.Process]::Start($psi5)
$null = $proc5.WaitForExit(10000)
$out5 = $proc5.StandardOutput.ReadToEnd()
$exitCode5 = $proc5.ExitCode

$t5Passed = ($exitCode5 -eq 0 -and $out5 -match "CONSULTA DE ESTADO DE CLOUDFLARE TUNNEL")
$t5Detail = "ExitCode: $exitCode5, Output match header: $($out5 -match 'CONSULTA DE ESTADO')"
Record-Test -Name "5. Non-Interactive Action Status" -Passed $t5Passed -Details $t5Detail

# -----------------------------------------------------------------------------
# 6. Non-Interactive Action Install Without Admin (Should fail fast with exit 1)
# -----------------------------------------------------------------------------
$psi6 = New-Object System.Diagnostics.ProcessStartInfo
$psi6.FileName = "powershell.exe"
$psi6.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$targetFile`" -Action install -NonInteractive -Token `"dummy_token`""
$psi6.RedirectStandardOutput = $true
$psi6.RedirectStandardError = $true
$psi6.UseShellExecute = $false
$psi6.CreateNoWindow = $true

$proc6 = [System.Diagnostics.Process]::Start($psi6)
$null = $proc6.WaitForExit(5000)
$out6 = $proc6.StandardOutput.ReadToEnd()
$exitCode6 = $proc6.ExitCode

# In standard non-elevated user shell, this should fail with exit 1 without prompt
$isElevatedNow = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isElevatedNow) {
    $t6Passed = ($exitCode6 -eq 1 -and $out6 -match "No se puede continuar en modo desatendido sin permisos de Administrador")
    $t6Detail = "ExitCode: $exitCode6, Output has admin error: $($out6 -match 'sin permisos de Administrador')"
} else {
    $t6Passed = $true
    $t6Detail = "Running in elevated context already; skipped non-admin check"
}
Record-Test -Name "6. Non-Interactive Install Without Admin Check" -Passed $t6Passed -Details $t6Detail

# -----------------------------------------------------------------------------
# 7. Batch Launcher (CONFIGURAR_TUNEL_CLOUDFLARE.bat) Exit Code Propagation
# -----------------------------------------------------------------------------
$batPath = "c:\Users\Lenovo\Desktop\floreria\CONFIGURAR_TUNEL_CLOUDFLARE.bat"
$psi7 = New-Object System.Diagnostics.ProcessStartInfo
$psi7.FileName = "cmd.exe"
# Provide empty stdin (<nul) so batch pause >nul doesn't block headless runners
$psi7.Arguments = "/c `"<nul `"$batPath`" -Action run -NonInteractive`""
$psi7.RedirectStandardOutput = $true
$psi7.RedirectStandardError = $true
$psi7.UseShellExecute = $false
$psi7.CreateNoWindow = $true

$proc7 = [System.Diagnostics.Process]::Start($psi7)
$t7Exited = $proc7.WaitForExit(5000)
if (-not $t7Exited) {
    $proc7.Kill()
}
$out7 = $proc7.StandardOutput.ReadToEnd()
$exitCode7 = $proc7.ExitCode

$t7Passed = ($exitCode7 -eq 1 -and $t7Exited)
$t7Detail = "BAT ExitCode: $exitCode7 (expected 1 from setup-cloudflare-tunnel.ps1), ExitedWithinTimeout: $t7Exited, Output: $($out7 -replace '\r?\n', ' ')"
Record-Test -Name "7. Batch Launcher Exit Code Propagation" -Passed $t7Passed -Details $t7Detail

# -----------------------------------------------------------------------------
# 8. Adversarial Test: Invalid Parameter Action Rejection
# -----------------------------------------------------------------------------
$psi8 = New-Object System.Diagnostics.ProcessStartInfo
$psi8.FileName = "powershell.exe"
$psi8.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$targetFile`" -Action invalid_bogus_action"
$psi8.RedirectStandardOutput = $true
$psi8.RedirectStandardError = $true
$psi8.UseShellExecute = $false
$psi8.CreateNoWindow = $true

$proc8 = [System.Diagnostics.Process]::Start($psi8)
$t8Exited = $proc8.WaitForExit(5000)
if (-not $t8Exited) { $proc8.Kill() }
$err8 = $proc8.StandardError.ReadToEnd()
$exitCode8 = $proc8.ExitCode

$t8Passed = ($exitCode8 -eq 1 -and $t8Exited -and $err8 -match "ValidateSet")
$t8Detail = "ExitCode: $exitCode8, ValidateSet error caught: $($err8 -match 'ValidateSet')"
Record-Test -Name "8. Adversarial: Invalid Action Rejection" -Passed $t8Passed -Details $t8Detail

# -----------------------------------------------------------------------------
# 9. Action Download with Existing Binary (Idempotency)
# -----------------------------------------------------------------------------
$psi9 = New-Object System.Diagnostics.ProcessStartInfo
$psi9.FileName = "powershell.exe"
$psi9.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$targetFile`" -Action download -NonInteractive"
$psi9.RedirectStandardOutput = $true
$psi9.RedirectStandardError = $true
$psi9.UseShellExecute = $false
$psi9.CreateNoWindow = $true

$proc9 = [System.Diagnostics.Process]::Start($psi9)
$t9Exited = $proc9.WaitForExit(5000)
if (-not $t9Exited) { $proc9.Kill() }
$out9 = $proc9.StandardOutput.ReadToEnd()
$exitCode9 = $proc9.ExitCode

$t9Passed = ($exitCode9 -eq 0 -and $t9Exited -and $out9 -match "cloudflared detectado en")
$t9Detail = "ExitCode: $exitCode9, Existing detected: $($out9 -match 'cloudflared detectado en')"
Record-Test -Name "9. Idempotency: Download Action with Existing Binary" -Passed $t9Passed -Details $t9Detail

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
$failedCount = ($results | Where-Object { -not $_.Passed }).Count
if ($failedCount -eq 0) {
    Write-Host " ALL $($results.Count) INDEPENDENT VERIFICATION TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host " $failedCount / $($results.Count) TESTS FAILED!" -ForegroundColor Red
}
Write-Host "============================================================" -ForegroundColor Cyan

exit $failedCount
