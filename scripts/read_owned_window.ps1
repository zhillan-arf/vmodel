param([Parameter(Mandatory=$true)][string]$Title, [Parameter(Mandatory=$true)][int]$BrowserProcessId, [switch]$InspectOwnedCaptions)
$ErrorActionPreference = 'Stop'
if ((!$Title.StartsWith('Ene Output Diagnostic ') -and !$Title.StartsWith('Ene Output Soak ')) -or $BrowserProcessId -le 0) { throw 'Only the exact owned diagnostic/soak title and positive browser PID are permitted.' }
Add-Type @'
using System;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Text;
public static class EneOwnedWindowRead {
 public delegate bool Callback(IntPtr h,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")]public static extern bool EnumWindows(Callback c,IntPtr p);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")]public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
 [DllImport("dwmapi.dll")]public static extern int DwmGetWindowAttribute(IntPtr h,int attr,out int value,int size);
 public static IntPtr[] Find(uint pid,string title) {var found=new List<IntPtr>();EnumWindows((h,p)=>{uint actual;GetWindowThreadProcessId(h,out actual);if(actual==pid){var s=new StringBuilder(512);GetWindowText(h,s,512);if(s.ToString()==title||s.ToString()==title+" - Google Chrome")found.Add(h);}return true;},IntPtr.Zero);return found.ToArray();}
 public static string[] Captions(uint pid){var found=new List<string>();EnumWindows((h,p)=>{uint actual;GetWindowThreadProcessId(h,out actual);if(actual==pid){var s=new StringBuilder(512);GetWindowText(h,s,512);if(s.Length>0)found.Add(s.ToString());}return found.Count<16;},IntPtr.Zero);return found.ToArray();}
}
'@
$eneMatches = [EneOwnedWindowRead]::Find($BrowserProcessId,$Title)
$eneWindows = @($eneMatches | ForEach-Object {
  $eneRect = New-Object EneOwnedWindowRead+Rect
  [void][EneOwnedWindowRead]::GetWindowRect($_,[ref]$eneRect)
  $eneCloaked = 0; $eneDwm = [EneOwnedWindowRead]::DwmGetWindowAttribute($_,14,[ref]$eneCloaked,4)
  [ordered]@{ handle = $_.ToString('X'); visible = [EneOwnedWindowRead]::IsWindowVisible($_); minimized = [EneOwnedWindowRead]::IsIconic($_); foreground = ([EneOwnedWindowRead]::GetForegroundWindow() -eq $_); cloaked = $(if($eneDwm -eq 0){$eneCloaked}else{$null}); rectangle = $eneRect }
})
$eneDesktop = (& (Join-Path $PSScriptRoot 'read_input_desktop.ps1')) | ConvertFrom-Json
[ordered]@{ observedAtUTC = [DateTime]::UtcNow.ToString('o'); ownedBrowserProcessId = $BrowserProcessId; matchingWindows = $eneWindows; desktop = $eneDesktop; ownedCaptions = $(if($InspectOwnedCaptions){@([EneOwnedWindowRead]::Captions($BrowserProcessId))}else{$null}) } | ConvertTo-Json -Depth 6
