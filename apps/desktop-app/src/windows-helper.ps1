$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class PromptClarityNative {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
}
"@

$currentPid = [System.Diagnostics.Process]::GetCurrentProcess().Id

function Send-Log($Msg) {
    [Console]::Error.WriteLine("[HELPER] $Msg")
}

function Send-Response($Id, $Ok, $Result = $null, $ErrorMessage = $null) {
    @{ id = $Id; ok = $Ok; result = $Result; error = $ErrorMessage } |
        ConvertTo-Json -Compress -Depth 5 |
        Write-Output
}

function Invoke-Capture($Sentinel = '', $OriginalHandle) {
    $rawHandle = [string]$OriginalHandle
    if ([string]::IsNullOrWhiteSpace($rawHandle)) {
        $targetHandle = [PromptClarityNative]::GetForegroundWindow()
    } elseif ($rawHandle -match '^\d+$') {
        $targetHandle = [IntPtr]::new([Int64]::Parse($rawHandle))
    } else {
        throw "Invalid target window handle."
    }
    if ($targetHandle -eq [IntPtr]::Zero) {
        throw "Could not identify the target window."
    }
    $processId = [uint32]0
    [PromptClarityNative]::GetWindowThreadProcessId($targetHandle, [ref]$processId) | Out-Null
    $processName = ""
    try { $processName = (Get-Process -Id $processId).ProcessName } catch {}

    # Confirm Focus
    $beforeFocus = [PromptClarityNative]::GetForegroundWindow()
    [PromptClarityNative]::SetForegroundWindow($targetHandle) | Out-Null
    Start-Sleep -Milliseconds 150
    $afterFocus = [PromptClarityNative]::GetForegroundWindow()
    $focusConfirmed = ($afterFocus -eq $targetHandle)
    
    Send-Log "Target: $processName ($targetHandle). FocusConfirmed: $focusConfirmed"

    $selectionState = 'EMPTY'
    $copiedLength = 0
    $helperError = if ($focusConfirmed) { $null } else { "Failed to focus target" }
    $formats = ""

    if ($focusConfirmed) {
        $clipText = ''
        $focused = $null
        try {
            $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
            $pattern = $null
            if ($null -ne $focused -and
                $focused.TryGetCurrentPattern(
                    [System.Windows.Automation.TextPattern]::Pattern,
                    [ref]$pattern
                )) {
                $selectionText = (
                    $pattern.GetSelection() |
                    ForEach-Object { $_.GetText(-1) }
                ) -join ''
                if (-not [string]::IsNullOrWhiteSpace($selectionText)) {
                    [System.Windows.Forms.Clipboard]::SetText($selectionText)
                    $clipText = $selectionText
                }
            }
        } catch {
            Send-Log "UI Automation selection read failed."
        }
        
        if (-not [string]::IsNullOrWhiteSpace($clipText) -and $clipText -ne $Sentinel) {
            $selectionState = 'HAS_SELECTION'
            $copiedLength = $clipText.Length
        } else {
            # Fallback for editors that do not expose TextPattern.
            [System.Windows.Forms.SendKeys]::SendWait('^c')
            Start-Sleep -Milliseconds 100
            try { $clipText = [System.Windows.Forms.Clipboard]::GetText() } catch {}
            
            if (-not [string]::IsNullOrWhiteSpace($clipText) -and $clipText -ne $Sentinel) {
                $selectionState = 'HAS_SELECTION'
                $copiedLength = $clipText.Length
            } else {
            # Try select all copy
            [System.Windows.Forms.SendKeys]::SendWait('^a')
            Start-Sleep -Milliseconds 100
            [System.Windows.Forms.SendKeys]::SendWait('^c')
            Start-Sleep -Milliseconds 100
            try { $clipText = [System.Windows.Forms.Clipboard]::GetText() } catch {}
            if (-not [string]::IsNullOrWhiteSpace($clipText) -and $clipText -ne $Sentinel) {
                $selectionState = 'AUTO_SELECTED'
                $copiedLength = $clipText.Length
            }
            }
        }
    }

    try {
        $dataObject = [System.Windows.Forms.Clipboard]::GetDataObject()
        if ($dataObject) {
            $formats = ($dataObject.GetFormats($false) -join ',')
        }
    } catch {}

    return @{
        foregroundWindowHandle = $beforeFocus.ToInt64().ToString()
        actualForegroundHandle = $afterFocus.ToInt64().ToString()
        focusConfirmed         = $focusConfirmed
        targetWindowHandle     = $targetHandle.ToInt64().ToString()
        processName            = $processName
        selectionState         = $selectionState
        copiedLength           = $copiedLength
        availableFormats       = $formats
        helperError            = $helperError
    }
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $request = $null
    try {
        $request = $line | ConvertFrom-Json
        if ($request.command -eq 'capture') {
            Send-Response $request.id $true (Invoke-Capture $request.sentinel $request.originalHandle)
        } elseif ($request.command -eq 'paste') {
             # ... (paste logic)
        }
    } catch {
        $id = if ($null -ne $request) { $request.id } else { -1 }
        Send-Response $id $false $null $_.Exception.Message
    }
}
