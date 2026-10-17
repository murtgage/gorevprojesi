# Görevlerim - bağımlılıksız yerel geliştirme sunucusu
# Kullanım:  powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1
#            powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1 -Port 8080

param(
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$mime = @{
    '.html'  = 'text/html; charset=utf-8'
    '.htm'   = 'text/html; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.js'    = 'text/javascript; charset=utf-8'
    '.mjs'   = 'text/javascript; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.svg'   = 'image/svg+xml'
    '.png'   = 'image/png'
    '.jpg'   = 'image/jpeg'
    '.jpeg'  = 'image/jpeg'
    '.gif'   = 'image/gif'
    '.webp'  = 'image/webp'
    '.ico'   = 'image/x-icon'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
    '.txt'   = 'text/plain; charset=utf-8'
}

function Send-Response {
    param(
        [System.Net.Sockets.TcpClient]$Client,
        [int]$Status,
        [string]$Reason,
        [string]$ContentType,
        [byte[]]$Body,
        [switch]$HeadOnly
    )

    if ($null -eq $Body) { $Body = [byte[]]::new(0) }

    $headers = "HTTP/1.1 $Status $Reason`r`n" +
               "Content-Type: $ContentType`r`n" +
               "Content-Length: $($Body.Length)`r`n" +
               "Cache-Control: no-store`r`n" +
               "Connection: close`r`n" +
               "X-Content-Type-Options: nosniff`r`n`r`n"

    $head = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $stream = $Client.GetStream()
    $stream.Write($head, 0, $head.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $stream.Write($Body, 0, $Body.Length)
    }
    $stream.Flush()
    $Client.Close()
}

function Send-Text {
    param($Client, [int]$Status, [string]$Reason, [string]$Text, [switch]$HeadOnly)
    Send-Response -Client $Client -Status $Status -Reason $Reason `
        -ContentType 'text/plain; charset=utf-8' `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($Text)) -HeadOnly:$HeadOnly
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host ""
Write-Host "  Görevlerim çalışıyor  ->  http://localhost:$Port/" -ForegroundColor Green
Write-Host "  Klasör: $root"
Write-Host "  Durdurmak için Ctrl+C`n"

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $client.ReceiveTimeout = 5000
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)

        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) {
            $client.Close()
            continue
        }

        # İstek başlıklarını tüket
        while ($true) {
            $line = $reader.ReadLine()
            if ($null -eq $line -or $line -eq '') { break }
        }

        $parts = $requestLine -split ' '
        $method = $parts[0]
        $rawPath = if ($parts.Length -gt 1) { $parts[1] } else { '/' }
        $headOnly = $method -eq 'HEAD'

        if ($method -ne 'GET' -and $method -ne 'HEAD') {
            Send-Text -Client $client -Status 405 -Reason 'Method Not Allowed' -Text '405 Metot desteklenmiyor' -HeadOnly:$headOnly
            continue
        }

        $pathOnly = ($rawPath -split '\?')[0]
        try { $pathOnly = [System.Uri]::UnescapeDataString($pathOnly) } catch { }
        if ([string]::IsNullOrWhiteSpace($pathOnly) -or $pathOnly -eq '/') { $pathOnly = '/index.html' }

        $relative = $pathOnly.TrimStart('/') -replace '/', '\'
        $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))

        if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            Send-Text -Client $client -Status 403 -Reason 'Forbidden' -Text '403 Yasak' -HeadOnly:$headOnly
            continue
        }

        if (Test-Path -LiteralPath $full -PathType Container) {
            $full = Join-Path $full 'index.html'
        }

        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            $body = "<meta charset='utf-8'><h1>404</h1><p>Bulunamadı: $pathOnly</p><p><a href='/'>Ana sayfa</a></p>"
            Send-Response -Client $client -Status 404 -Reason 'Not Found' `
                -ContentType 'text/html; charset=utf-8' `
                -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -HeadOnly:$headOnly
            Write-Host ("  404  {0}" -f $pathOnly) -ForegroundColor DarkYellow
            continue
        }

        $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
        $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($full)

        Send-Response -Client $client -Status 200 -Reason 'OK' -ContentType $contentType -Body $bytes -HeadOnly:$headOnly
        Write-Host ("  200  {0}" -f $pathOnly) -ForegroundColor DarkGray
    }
    catch {
        try { $client.Close() } catch { }
        Write-Host ("  Hata: {0}" -f $_.Exception.Message) -ForegroundColor DarkRed
    }
}
