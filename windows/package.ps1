param([Parameter(Mandatory)][string]$OutputDir)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$site = Join-Path $OutputDir 'site'
$runtime = Join-Path $site 'runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($name in 'index.html','runner.js','paper.js','review.js','python-refs.js','icon-192.png','icon-512.png','manifest.webmanifest','sample-frame.html','sw.js') {
    Copy-Item -LiteralPath (Join-Path $root $name) -Destination $site
}
foreach ($name in 'pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json') {
    Copy-Item -LiteralPath (Join-Path $root "node_modules/pyodide/$name") -Destination $runtime
}
function Replace-Text($name,$old,$new) {
    $file=Join-Path $site $name
    $content=[IO.File]::ReadAllText($file)
    if (!$content.Contains($old)) { throw "Missing packaging marker in $name" }
    [IO.File]::WriteAllText($file,$content.Replace($old,$new),$utf8)
}
Replace-Text 'sample-frame.html' 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' 'http://127.0.0.1:41763/runtime/'
Replace-Text 'sample-frame.html' 'https://cdn.jsdelivr.net' 'http://127.0.0.1:41763'
Replace-Text 'runner.js' '首次运行需要联网加载 Python 环境。' 'Python 环境已随离线版安装。'
Replace-Text 'index.html' '运行 Python 样例与外部 OJ 需要联网。' 'Python 样例可离线运行，外部 OJ 需要联网。'
# The local server always serves the installed version, including after upgrades.
Replace-Text 'index.html' 'navigator.serviceWorker.register("./sw.js")' 'Promise.resolve()'
Replace-Text 'index.html' '.then(()=>navigator.serviceWorker.ready)' ''
Replace-Text 'index.html' 'downloads/CSP-helper-v1.0.apk",base' 'https://gehjaja.github.io/CSP-helper/downloads/CSP-helper-v1.0.apk",base'
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe'
& $csc /nologo /target:winexe /platform:anycpu /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$(Join-Path $OutputDir 'CSP-helper.exe')" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE) {throw 'Launcher compilation failed'}
