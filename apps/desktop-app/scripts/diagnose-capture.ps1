$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class PromptDiagNative {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
}
"@

$hwnd = [PromptDiagNative]::GetForegroundWindow()
$pidVal = [uint32]0
[PromptDiagNative]::GetWindowThreadProcessId($hwnd, [ref]$pidVal) | Out-Null
$pName = ""
try { $pName = (Get-Process -Id $pidVal).ProcessName } catch {}

$focusedType = "None"
try {
  $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($null -ne $focused) {
    $focusedType = $focused.Current.ControlType.ProgrammaticName
  }
} catch {}

[PSCustomObject]@{
  ForegroundHandle = $hwnd.ToInt64().ToString()
  ProcessId = $pidVal
  ProcessName = $pName
  FocusedControlType = $focusedType
  IsVisible = [PromptDiagNative]::IsWindowVisible($hwnd)
} | ConvertTo-Json -Compress | Write-Output
