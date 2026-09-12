# Read-only current-session diagnostics. Never opens media, changes/switches a desktop or unlocks Windows.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class EneDesktopReadOnly {
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool CloseDesktop(IntPtr desktop);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr GetThreadDesktop(uint threadId);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll")] public static extern uint WTSGetActiveConsoleSessionId();
  [DllImport("user32.dll", EntryPoint="GetUserObjectInformationW", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool GetUserObjectInformation(IntPtr handle, int index, StringBuilder value, int length, out uint needed);
  public static string Name(IntPtr handle) {
    uint needed; var name = new StringBuilder(256);
    if (!GetUserObjectInformation(handle, 2, name, 512, out needed)) return "Unavailable (Win32 " + Marshal.GetLastWin32Error() + ")";
    return name.ToString();
  }
}
'@
$eneDesktop = [EneDesktopReadOnly]::OpenInputDesktop(0, $false, 1)
$eneError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
try {
  [ordered]@{
    observedAtUTC = [DateTime]::UtcNow.ToString('o')
    processSessionId = (Get-Process -Id $PID).SessionId
    activeConsoleSessionId = [EneDesktopReadOnly]::WTSGetActiveConsoleSessionId()
    threadDesktop = [EneDesktopReadOnly]::Name([EneDesktopReadOnly]::GetThreadDesktop([EneDesktopReadOnly]::GetCurrentThreadId()))
    inputDesktop = $(if ($eneDesktop -ne [IntPtr]::Zero) { [EneDesktopReadOnly]::Name($eneDesktop) } else { $null })
    inputDesktopOpenError = $(if ($eneDesktop -eq [IntPtr]::Zero) { $eneError } else { $null })
    limitation = 'Current observation only; does not establish desktop state during the earlier recording or change/unlock Windows.'
  } | ConvertTo-Json
} finally { if ($eneDesktop -ne [IntPtr]::Zero) { [void][EneDesktopReadOnly]::CloseDesktop($eneDesktop) } }
