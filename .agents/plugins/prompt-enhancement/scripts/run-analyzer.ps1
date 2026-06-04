<# 
.SYNOPSIS
  Runs the Prompt Enhancement analyzer CLI script.

.DESCRIPTION
  Compiles (if needed) and executes the analyze-prompt.ts script via npx tsx.

.PARAMETER Prompt
  The prompt text to analyze.

.PARAMETER UseCase
  The use case context. One of: general, coding, writing, studying, research, business, imageGeneration.
  Defaults to "general".

.EXAMPLE
  .\run-analyzer.ps1 -Prompt "explain how React hooks work" -UseCase coding
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt,

    [Parameter(Mandatory=$false)]
    [ValidateSet("general", "coding", "writing", "studying", "research", "business", "imageGeneration")]
    [string]$UseCase = "general"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Try to find the project root dynamically
$possibleRoots = @(
    (Join-Path $scriptDir "..\..\..\.."),
    (Join-Path $scriptDir "..\..\..\..\Grammarly-Prompts")
)

$projectRoot = $null
foreach ($root in $possibleRoots) {
    if (Test-Path (Join-Path $root "lib\promptAnalyzer.js")) {
        $projectRoot = Resolve-Path $root
        break
    }
}

if ($null -eq $projectRoot) {
    Write-Error "Could not find project root containing lib\promptAnalyzer.js"
    exit 1
}

$analyzerScript = Join-Path $scriptDir "analyze-prompt.js"

Push-Location $projectRoot
try {
    node $analyzerScript --prompt $Prompt --useCase $UseCase
} finally {
    Pop-Location
}
