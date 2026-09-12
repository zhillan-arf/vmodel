# Opaque topmost window used only to occlude the owned diagnostic viewer.
# It draws a solid colour, takes no input focus loop and exits when killed.
param([int]$Seconds = 30)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = 'VModel Occlusion Probe'
$form.FormBorderStyle = 'None'
$form.WindowState = 'Maximized'
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 24)
$form.ShowInTaskbar = $false
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = [Math]::Max(1000, $Seconds * 1000)
$timer.Add_Tick({ $timer.Stop(); $form.Close() })
$form.Add_Shown({ $timer.Start() })
[System.Windows.Forms.Application]::Run($form)
