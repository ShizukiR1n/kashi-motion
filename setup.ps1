# kashi-motion 一键安装（Windows PowerShell）
#   用法：在仓库根目录运行  powershell -ExecutionPolicy Bypass -File setup.ps1
#   需要预先安装：Python 3.11+、Node.js 18+（含 npm）
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host '== 1/4 Python 虚拟环境 (.venv)'
if (-not (Test-Path .venv)) { python -m venv .venv }
$py = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
& $py -m pip install --upgrade pip
& $py -m pip install torch==2.14.1 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cpu
& $py -m pip install -r requirements.txt

Write-Host '== 2/4 Node 依赖'
npm ci

Write-Host '== 3/4 KanjiVG 笔画数据（笔画拼接效果用，CC BY-SA 3.0，见 docs/third-party.md）'
$kv = 'tools\data\kanjivg'
if (-not (Get-ChildItem $kv -Filter *.zip -ErrorAction SilentlyContinue)) {
  New-Item -ItemType Directory -Force $kv | Out-Null
  $rel = Invoke-RestMethod 'https://api.github.com/repos/KanjiVG/kanjivg/releases/latest'
  $asset = $rel.assets | Where-Object { $_.name -like '*main.zip' } | Select-Object -First 1
  if ($asset) {
    Invoke-WebRequest $asset.browser_download_url -OutFile (Join-Path $kv 'kanjivg-main.zip')
  } else {
    Write-Warning '没找到 KanjiVG 的 main.zip，请手动下载放进 tools\data\kanjivg\（不影响其他功能）'
  }
}

Write-Host '== 4/4 检查环境'
& $py lv.py doctor
Write-Host ''
Write-Host '完成。之后请用 .venv\Scripts\python.exe 运行 lv.py，例如：'
Write-Host '  .venv\Scripts\python.exe lv.py demo --stills 7,17,30'
