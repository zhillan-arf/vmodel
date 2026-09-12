# Narrow read-only current power observation and relevant event metadata. No setters or escalation.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;using System.Runtime.InteropServices;using System.Threading;
public static class EnePowerReadOnly {
 [StructLayout(LayoutKind.Sequential)]public struct PowerStatus {public byte ACLineStatus,BatteryFlag,BatteryLifePercent,SystemStatusFlag;public uint BatteryLifeTime,BatteryFullLifeTime;}
 public class Snapshot {public bool Available;public PowerStatus Status;public int Mode=-1,RegisterResult,UnregisterResult;}
 public delegate void ModeCallback(int mode,IntPtr context);
 [DllImport("kernel32.dll",SetLastError=true)]public static extern bool GetSystemPowerStatus(out PowerStatus status);
 [DllImport("powrprof.dll")]public static extern int PowerRegisterForEffectivePowerModeNotifications(uint version,ModeCallback callback,IntPtr context,out IntPtr handle);
 [DllImport("powrprof.dll")]public static extern int PowerUnregisterFromEffectivePowerModeNotifications(IntPtr handle);
 public static Snapshot Read(){var s=new Snapshot();s.Available=GetSystemPowerStatus(out s.Status);using(var ready=new ManualResetEvent(false)){ModeCallback callback=(mode,ctx)=>{s.Mode=mode;ready.Set();};IntPtr handle;s.RegisterResult=PowerRegisterForEffectivePowerModeNotifications(2,callback,IntPtr.Zero,out handle);if(s.RegisterResult==0){ready.WaitOne(1000);s.UnregisterResult=PowerUnregisterFromEffectivePowerModeNotifications(handle);}GC.KeepAlive(callback);}return s;}
}
'@
$eneSnapshot = [EnePowerReadOnly]::Read()
$eneModeNames = @('BatterySaver','BetterBattery','Balanced','HighPerformance','MaxPerformance','GameMode','MixedReality')
[ordered]@{ observedAtUTC=[DateTime]::UtcNow.ToString('o'); systemPower=$eneSnapshot; effectivePowerMode=$(if($eneSnapshot.Mode -ge 0 -and $eneSnapshot.Mode -lt $eneModeNames.Count){$eneModeNames[$eneSnapshot.Mode]}else{'Unknown'}); activeScheme=@(powercfg /getactivescheme); readOnly=$true } | ConvertTo-Json -Depth 5
