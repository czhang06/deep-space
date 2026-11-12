# Long-lived helper: prints one JSON line describing the foreground window every couple of seconds.
# Started once by Deep Space and exits on its own when the app (its parent) goes away.
# Nothing here is written to disk; the app keeps window titles in memory only.
param(
    [int]$ParentPid = 0,
    [double]$IntervalSeconds = 2
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class TinyKingdomForeground
{
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

# Process names, descriptions and paths don't change for a given pid, so look them up once.
$processCache = @{}
$sleepMs = [int]($IntervalSeconds * 1000)

while ($true) {
    if ($ParentPid -gt 0) {
        try {
            [System.Diagnostics.Process]::GetProcessById($ParentPid) | Out-Null
        } catch {
            exit 0
        }
    }

    try {
        $hwnd = [TinyKingdomForeground]::GetForegroundWindow()
        $processId = [uint32]0
        [TinyKingdomForeground]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null

        $length = [TinyKingdomForeground]::GetWindowTextLength($hwnd)
        $builder = New-Object System.Text.StringBuilder ($length + 1)
        [TinyKingdomForeground]::GetWindowText($hwnd, $builder, $builder.Capacity) | Out-Null

        $info = $null
        if ($processId -gt 0) {
            $info = $processCache[$processId]
            if (-not $info) {
                $name = $null
                $description = $null
                $path = $null
                try {
                    $process = [System.Diagnostics.Process]::GetProcessById([int]$processId)
                    $name = $process.ProcessName
                    try {
                        $path = $process.MainModule.FileName
                        $description = $process.MainModule.FileVersionInfo.FileDescription
                    } catch {
                        # Elevated or protected processes don't expose their module; the name is enough.
                    }
                } catch {
                    $name = $null
                }
                $info = @{ name = $name; description = $description; path = $path }
                if ($processCache.Count -gt 300) { $processCache.Clear() }
                $processCache[$processId] = $info
            }
        }

        $line = [pscustomobject]@{
            processId   = $processId
            processName = if ($info) { $info.name } else { $null }
            appName     = if ($info -and $info.description) { $info.description } elseif ($info) { $info.name } else { $null }
            exePath     = if ($info) { $info.path } else { $null }
            windowTitle = $builder.ToString().Trim()
        } | ConvertTo-Json -Compress

        [Console]::Out.WriteLine($line)
        [Console]::Out.Flush()
    } catch {
        [Console]::Out.WriteLine('{"error":"sample failed"}')
        [Console]::Out.Flush()
    }

    Start-Sleep -Milliseconds $sleepMs
}
