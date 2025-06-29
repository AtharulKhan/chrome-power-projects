# PowerShell script to create placeholder icons for Chrome extension

$icons = @{
  "icon16.png"  = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z/C/HwAFgwJ/lwQn1wAAAABJRU5ErkJggg=="
  "icon32.png"  = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGUlEQVR42mP8z/C/HwMDAwMjI2NgYGBgAAAwAABJkA9nAAAAAASUVORK5CYII="
  "icon48.png"  = "iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAAGUlEQVR42mP8z/C/HwMDAwMjI2NgYGBgAAAwAABJkA9nAAAAAASUVORK5CYII="
  "icon128.png" = "iVBORw0KGgoAAAANSUhEUgAAAI AAAACACAYAAADDPmHLAAAAGUlEQVR42mP8z/C/HwMDAwMjI2NgYGBgAAAwAABJkA9nAAAAAASUVORK5CYII="
}

foreach ($name in $icons.Keys) {
  [IO.File]::WriteAllBytes($name, [Convert]::FromBase64String($icons[$name]))
}
Write-Host "Icons created: icon16.png, icon32.png, icon48.png, icon128.png"
