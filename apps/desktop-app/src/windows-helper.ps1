$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PromptGrammarlyNative {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

function Send-Response($Id, $Ok, $Result = $null, $ErrorMessage = $null) {
  @{ id = $Id; ok = $Ok; result = $Result; error = $ErrorMessage } |
    ConvertTo-Json -Compress -Depth 5 |
    Write-Output
}

function Invoke-Capture {
  $handle = [PromptGrammarlyNative]::GetForegroundWindow()
  $processId = [uint32]0
  [PromptGrammarlyNative]::GetWindowThreadProcessId($handle, [ref]$processId) | Out-Null
  $processName = ''
  try { $processName = (Get-Process -Id $processId).ProcessName } catch {}
  $selectionState = 'UNKNOWN'
  $caretAtEnd = $null
  $isTextControl = $false
  try {
    $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
    if ($null -ne $focused) {
      $controlType = $focused.Current.ControlType.ProgrammaticName
      $isTextControl = $controlType -in @('ControlType.Edit', 'ControlType.Document')
    }
    $pattern = $null
    if ($null -ne $focused -and $focused.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
      $selectionRanges = $pattern.GetSelection()
      $selectedText = (($selectionRanges | ForEach-Object { $_.GetText(-1) }) -join '')
      if ([string]::IsNullOrWhiteSpace($selectedText)) {
        $selectionState = 'EMPTY'
        if ($selectionRanges.Count -gt 0) {
          $comparison = $selectionRanges[0].CompareEndpoints(
            [System.Windows.Automation.TextPatternRangeEndpoint]::End,
            $pattern.DocumentRange,
            [System.Windows.Automation.TextPatternRangeEndpoint]::End)
          $caretAtEnd = $comparison -eq 0
        }
      } else { $selectionState = 'HAS_SELECTION' }
    }
  } catch {}

  $supported = $processName -match '^(Code(?: - Insiders)?|chrome|msedge|firefox|brave|opera|vivaldi|notepad)$'
  if (($selectionState -eq 'EMPTY' -or $selectionState -eq 'UNKNOWN') -and $supported) {
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    Start-Sleep -Milliseconds 100
    $selectionState = 'AUTO_SELECTED'
  } elseif ($selectionState -eq 'EMPTY' -and $caretAtEnd -eq $true -and $isTextControl) {
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    Start-Sleep -Milliseconds 100
    $selectionState = 'AUTO_SELECTED'
  }
  if ($selectionState -ne 'EMPTY') { [System.Windows.Forms.SendKeys]::SendWait('^c') }
  return @{
    windowHandle = $handle.ToInt64().ToString()
    selectionState = $selectionState
    processName = $processName
    caretAtEnd = $caretAtEnd
    isTextControl = $isTextControl
  }
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $request = $null
  try {
    $request = $line | ConvertFrom-Json
    if ($request.command -eq 'capture') {
      Send-Response $request.id $true (Invoke-Capture)
    } elseif ($request.command -eq 'paste') {
      $handle = [IntPtr]::new([Int64]::Parse([string]$request.windowHandle))
      if ([PromptGrammarlyNative]::IsIconic($handle)) { [PromptGrammarlyNative]::ShowWindowAsync($handle, 9) | Out-Null }
      [PromptGrammarlyNative]::SetForegroundWindow($handle) | Out-Null
      Start-Sleep -Milliseconds 120
      if ($request.selectAll -eq $true) {
        [System.Windows.Forms.SendKeys]::SendWait('^a')
        Start-Sleep -Milliseconds 80
      }
      [System.Windows.Forms.SendKeys]::SendWait('^v')
      Send-Response $request.id $true
    } else { Send-Response $request.id $false $null 'Unknown command.' }
  } catch {
    $id = if ($null -ne $request) { $request.id } else { -1 }
    Send-Response $id $false $null $_.Exception.Message
  }
}
