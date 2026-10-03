param([switch]$Cuda)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root '.local/research-venv'
if (-not (Test-Path -LiteralPath (Join-Path $venv 'Scripts/python.exe'))) {
    & py -3.12 -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.12, then retry research setup.' }
}
$python = Join-Path $venv 'Scripts/python.exe'
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip initialization failed.' }
$index = if ($Cuda) { 'https://download.pytorch.org/whl/cu128' } else { 'https://download.pytorch.org/whl/cpu' }
& $python -m pip install --upgrade torch==2.7.1 torchvision==0.22.1 --index-url $index
if ($LASTEXITCODE -ne 0) { throw 'PyTorch installation failed.' }
& $python -m pip install -r (Join-Path $PSScriptRoot 'research/requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Research dependencies could not be installed.' }
Write-Output 'Research runtime ready. Models download locally on first analysis; videos are never uploaded to model providers.'
