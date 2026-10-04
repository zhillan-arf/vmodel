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
$eneStart = [DateTime]::Parse('2026-09-12T11:45:00Z').ToUniversalTime()
$eneEnd = [DateTime]::UtcNow
$eneStartLocal = $eneStart.ToLocalTime(); $eneEndLocal = $eneEnd.ToLocalTime()
$eneQueries = @(
  @{ Name='power-source-sleep'; Filter=@{LogName='System';ProviderName='Microsoft-Windows-Kernel-Power';Id=@(105,42,107,506,507);StartTime=$eneStartLocal;EndTime=$eneEndLocal} },
  @{ Name='display-driver-recovery'; Filter=@{LogName='System';ProviderName='Display';Id=4101;StartTime=$eneStartLocal;EndTime=$eneEndLocal} },
  @{ Name='power-policy-change'; Filter=@{LogName='System';ProviderName='Microsoft-Windows-UserModePowerService';Id=@(12,13);StartTime=$eneStartLocal;EndTime=$eneEndLocal} },
  @{ Name='session-connect-disconnect'; Filter=@{LogName='Microsoft-Windows-TerminalServices-LocalSessionManager/Operational';Id=@(24,25);StartTime=$eneStartLocal;EndTime=$eneEndLocal} },
  @{ Name='session-lock-unlock'; Filter=@{LogName='Security';Id=@(4800,4801);StartTime=$eneStartLocal;EndTime=$eneEndLocal} }
)
$eneEventResults = @($eneQueries | ForEach-Object {
  $eneQuery = $_
  try {
    $eneEvents = @(Get-WinEvent -FilterHashtable $eneQuery.Filter -MaxEvents 20 -ErrorAction Stop | Where-Object { $_.TimeCreated.ToUniversalTime() -ge $eneStart -and $_.TimeCreated.ToUniversalTime() -le $eneEnd } | ForEach-Object {
      $eneXml = [xml]$_.ToXml(); $eneSelected = [ordered]@{}
      foreach ($eneData in $eneXml.Event.EventData.Data) { if ($eneData.Name -in @('AcOnline','Reason','SessionID','NewSchemeGuid','OldSchemeGuid','BatteryRemainingCapacity','BatteryFullChargeCapacity')) { $eneSelected[$eneData.Name] = $eneData.'#text' } }
      [ordered]@{timeUTC=$_.TimeCreated.ToUniversalTime().ToString('o');provider=$_.ProviderName;id=$_.Id;selectedData=$eneSelected}
    })
    [ordered]@{query=$eneQuery.Name;status='queried';limit=20;events=$eneEvents}
  } catch {
    [ordered]@{query=$eneQuery.Name;status=$(if($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*'){'no-matching-events'}else{'unavailable'});errorId=$_.FullyQualifiedErrorId;events=@()}
  }
})
$eneSnapshot = [EnePowerReadOnly]::Read()
$enePriorPowerSource = $null
try {
  $enePrior = Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-Power';Id=105;StartTime=$eneStart.Date.ToLocalTime();EndTime=$eneStartLocal} -MaxEvents 1 -ErrorAction Stop
  if ($enePrior.TimeCreated.ToUniversalTime() -ge $eneStart.Date -and $enePrior.TimeCreated.ToUniversalTime() -lt $eneStart) {
    $enePriorXml = [xml]$enePrior.ToXml()
    $enePriorPowerSource = [ordered]@{timeUTC=$enePrior.TimeCreated.ToUniversalTime().ToString('o');id=105;AcOnline=($enePriorXml.Event.EventData.Data | Where-Object Name -eq 'AcOnline').'#text';limit=1}
  }
} catch { $enePriorPowerSource = @{status='unavailable-or-no-match';errorId=$_.FullyQualifiedErrorId} }
$eneModeNames = @('BatterySaver','BetterBattery','Balanced','HighPerformance','MaxPerformance','GameMode','MixedReality')
$eneResult = [ordered]@{
  observedAtUTC=[DateTime]::UtcNow.ToString('o');systemPower=$eneSnapshot
  effectivePowerMode=$(if($eneSnapshot.Mode -ge 0 -and $eneSnapshot.Mode -lt $eneModeNames.Count){$eneModeNames[$eneSnapshot.Mode]}else{'Unknown'})
  activeScheme=@(powercfg /getactivescheme)
  mostRecentPowerSourceBeforeWindow=$enePriorPowerSource
  eventWindowUTC=@{start=$eneStart.ToString('o');end=$eneEnd.ToString('o')};eventQueries=$eneEventResults
  limitation='Current API state and only selected event IDs/metadata. No broad event messages, identities, power setters, desktop switching or escalation. Missing events do not establish absence of a transition.'
}
$eneJson = $eneResult | ConvertTo-Json -Depth 9
[IO.File]::WriteAllText((Join-Path $PWD 'ops/001-zhil/sprint-001/reports/power-state-comparison.json'),$eneJson+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
$eneJson
