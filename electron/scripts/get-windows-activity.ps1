$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class TinyKingdomWin32
{
    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO
    {
        public UInt32 cbSize;
        public UInt32 dwTime;
    }

    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int GetWindowTextLength(IntPtr hWnd);
}
"@

$lastInputInfo = New-Object TinyKingdomWin32+LASTINPUTINFO
$lastInputInfo.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lastInputInfo)
[TinyKingdomWin32]::GetLastInputInfo([ref]$lastInputInfo) | Out-Null

$idleMilliseconds = [Math]::Max(0, [Environment]::TickCount64 - [int64]$lastInputInfo.dwTime)
$foregroundWindow = [TinyKingdomWin32]::GetForegroundWindow()
$processId = 0
[TinyKingdomWin32]::GetWindowThreadProcessId($foregroundWindow, [ref]$processId) | Out-Null

$titleLength = [TinyKingdomWin32]::GetWindowTextLength($foregroundWindow)
$builder = New-Object System.Text.StringBuilder ($titleLength + 1)
[TinyKingdomWin32]::GetWindowText($foregroundWindow, $builder, $builder.Capacity) | Out-Null

$process = $null
if ($processId -gt 0) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
}

$fileDescription = $null
if ($process) {
    try {
        $fileDescription = $process.MainModule.FileVersionInfo.FileDescription
    } catch {
        $fileDescription = $null
    }
}

[pscustomobject]@{
    timestamp = (Get-Date).ToString("o")
    idleSeconds = [Math]::Floor($idleMilliseconds / 1000)
    processId = $processId
    processName = if ($process) { $process.ProcessName } else { $null }
    appName = if ($fileDescription) { $fileDescription } elseif ($process) { $process.ProcessName } else { $null }
    windowTitle = $builder.ToString().Trim()
} | ConvertTo-Json -Compress
