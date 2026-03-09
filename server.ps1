# Simple PowerShell HTTP Server for development
# Serves files from the current directory on port 3000

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:3000/")
$listener.Start()
Write-Host "Server running at http://localhost:3000/"
Write-Host "Press Ctrl+C to stop"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".m4a"  = "audio/mp4"
    ".mp3"  = "audio/mpeg"
    ".mp4"  = "video/mp4"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff2"= "font/woff2"
}

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
        if ($urlPath -eq "/") { $urlPath = "/index.html" }

        $filePath = Join-Path $root ($urlPath -replace "/", "\")

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

            $response.ContentType = $contentType
            $response.StatusCode = 200

            # Support Range requests for audio seeking
            $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
            $rangeHeader = $request.Headers["Range"]

            if ($rangeHeader -and $rangeHeader.StartsWith("bytes=")) {
                $rangeParts = $rangeHeader.Substring(6).Split("-")
                $start = [long]$rangeParts[0]
                $end = if ($rangeParts[1]) { [long]$rangeParts[1] } else { $fileBytes.Length - 1 }
                if ($end -ge $fileBytes.Length) { $end = $fileBytes.Length - 1 }
                $length = $end - $start + 1

                $response.StatusCode = 206
                $response.Headers.Add("Content-Range", "bytes $start-$end/$($fileBytes.Length)")
                $response.Headers.Add("Accept-Ranges", "bytes")
                $response.ContentLength64 = $length
                $response.OutputStream.Write($fileBytes, [int]$start, [int]$length)
            } else {
                $response.Headers.Add("Accept-Ranges", "bytes")
                $response.ContentLength64 = $fileBytes.Length
                $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            }

            Write-Host "$($request.HttpMethod) $urlPath -> 200 ($contentType)"
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "$($request.HttpMethod) $urlPath -> 404"
        }

        $response.OutputStream.Close()
    } catch {
        Write-Host "Error: $_"
    }
}
