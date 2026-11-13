# Regenerates DuckLook's app icon, favicon, and touch icon from the source artwork.
# Requires Windows PowerShell + System.Drawing. Usage: powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'assets\logo-source.png'
if (-not (Test-Path $sourcePath)) {
  throw "Source artwork not found: $sourcePath"
}

$source = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-PngBytes([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($source, 0, 0, $size, $size)
    $stream = New-Object System.IO.MemoryStream
    try {
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      return ,$stream.ToArray()
    } finally {
      $stream.Dispose()
    }
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Write-SizedPng([string]$relativePath, [int]$size) {
  $path = Join-Path $root $relativePath
  $directory = Split-Path -Parent $path
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }
  [System.IO.File]::WriteAllBytes($path, (Resize-PngBytes $size))
  Write-Output "wrote $relativePath (${size}x${size})"
}

Write-SizedPng 'assets\icon.png' 1024
Write-SizedPng 'assets\logo.png' 512
Write-SizedPng 'public\logo.png' 512
Write-SizedPng 'public\favicon.png' 64
Write-SizedPng 'public\apple-touch-icon.png' 180

# Build a multi-resolution Windows ICO with embedded PNG frames (Vista+).
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()
foreach ($size in $sizes) {
  $images += ,(Resize-PngBytes $size)
}

$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)
try {
  $writer.Write([UInt16]0)                 # reserved
  $writer.Write([UInt16]1)                 # icon type
  $writer.Write([UInt16]$sizes.Count)      # image count

  $offset = 6 + (16 * $sizes.Count)
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $bytes = $images[$i]
    $dimension = if ($size -ge 256) { 0 } else { $size }

    $writer.Write([byte]$dimension)        # width
    $writer.Write([byte]$dimension)        # height
    $writer.Write([byte]0)                 # palette count
    $writer.Write([byte]0)                 # reserved
    $writer.Write([UInt16]1)               # color planes
    $writer.Write([UInt16]32)              # bits per pixel
    $writer.Write([UInt32]$bytes.Length)   # image size
    $writer.Write([UInt32]$offset)         # image offset
    $offset += $bytes.Length
  }

  foreach ($bytes in $images) {
    $writer.Write($bytes)
  }

  $writer.Flush()
  $icoBytes = $stream.ToArray()
  [System.IO.File]::WriteAllBytes((Join-Path $root 'assets\icon.ico'), $icoBytes)
  [System.IO.File]::WriteAllBytes((Join-Path $root 'public\favicon.ico'), $icoBytes)
  Write-Output 'wrote assets\icon.ico and public\favicon.ico'
} finally {
  $writer.Dispose()
  $stream.Dispose()
  $source.Dispose()
}

Write-Output 'Icons generated.'
