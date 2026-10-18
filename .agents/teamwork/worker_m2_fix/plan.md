# Worker M2 Fix Plan
Remediate Reviewer 1 findings in scripts/setup-cloudflare-tunnel.ps1:
1. Replace $MyInvocation.MyCommand.Path with $PSCommandPath in Ensure-Elevation.
2. In Get-PromptedToken, guard against $NonInteractive when token is empty and exit code 1 instead of Read-Host hang.
3. Propagate $LASTEXITCODE properly.
