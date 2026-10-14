<#
  精简版 APK 构建脚本（中文优先、纯本机训练日志）。

  一个源码树、三种媒体策略，产出三个互不覆盖的 APK：

    remote  静态图随包（~2.7 MiB，缩略图与暂停帧即时显示），动画不打包：
            运行时按 -MediaBase / -GifMirrorBase 通过 HTTP 请求加载（必须联网）。
    local   当前版本：只打包白名单动作（热门家族 + 你的训练计划）的 180px 素材。
    full    不省略/不压缩：打包 catalogue/media 的全量素材。

  另外：签到扫码已完全不需要，每次 cap sync 之后都会把 ML Kit 条码插件从
  Android 工程里摘掉，APK 因此少掉约 19 MiB 的 libbarhopper_v3.so。
#>
[CmdletBinding()]
param(
    [ValidateSet('remote', 'local', 'full')]
    [string]$Variant = 'local',

    # remote 变体的素材来源。默认指向上游公开仓库的 180px 素材（jsDelivr CDN 镜像）。
    # 换成自建服务器时，只要给到 .../media 这一层即可，脚本会自己补 /still/ 与 /clip/。
    [string]$MediaBase = 'https://cdn.jsdelivr.net/gh/DuarteSantos8/openGym@main/catalogue/media',

    # remote 变体里命中练记素材的动作，改从这套 GIF 拉（其余动作仍走 -MediaBase 的 MP4）。
    # 素材来自练记(lianji-fitness)所用的同一套 hasaneyldrm/exercises-dataset，GIF 在 Android
    # WebView 里 <img> 自播比循环 MP4 顺。练记自己用的是 raw.githubusercontent（本机实测每个
    # GIF 2-4 秒）；这里默认换成同一仓库同一文件的 jsDelivr 镜像，快 3-10 倍。想完全用练记的
    # 原始地址，传 https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/
    [string]$GifMirrorBase = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/',

    [string]$JavaHome = 'D:\AndroidBuild\jdk21\jdk-21.0.2',
    [string]$AndroidSdk = 'D:\AndroidBuild\Sdk'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot 'frontend'
$androidDir = Join-Path $frontendDir 'android'
$outputsDir = Join-Path $repoRoot 'outputs'
$appAssetsDir = Join-Path $androidDir 'app\src\main\assets'
$apkSource = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'

$appVersion = (Get-Content -LiteralPath (Join-Path $frontendDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$apkName = switch ($Variant) {
    'remote' { "qinglian-lite-remote-v$appVersion-debug.apk" }
    'local'  { "qinglian-lite-local-v$appVersion-debug.apk" }
    'full'   { "qinglian-lite-fullmedia-v$appVersion-debug.apk" }
}
$apkTarget = Join-Path $outputsDir $apkName

if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) {
    throw "Java 21 not found at $JavaHome"
}
if (-not (Test-Path -LiteralPath (Join-Path $AndroidSdk 'platforms\android-35\android.jar'))) {
    throw "Android SDK 35 not found at $AndroidSdk"
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:Path = "$JavaHome\bin;$AndroidSdk\platform-tools;$env:Path"
$env:VITE_MOBILE = '1'
$env:VITE_LITE = '1'

$mediaRoot = $MediaBase.TrimEnd('/')
if ($Variant -eq 'remote') {
    # 静态图随包：不设 VITE_IMG_BASE，走默认的本地 exercise-media/still/。
    # 动画仍从 CDN 取，所以 VITE_GIF_BASE 指向远端 clip 目录。
    Remove-Item Env:\VITE_IMG_BASE -ErrorAction SilentlyContinue
    $env:VITE_GIF_BASE = "$mediaRoot/clip/"
    $env:VITE_GIF_MIRROR_BASE = $GifMirrorBase.TrimEnd('/') + '/'
} else {
    Remove-Item Env:\VITE_IMG_BASE -ErrorAction SilentlyContinue
    Remove-Item Env:\VITE_GIF_BASE -ErrorAction SilentlyContinue
    Remove-Item Env:\VITE_GIF_MIRROR_BASE -ErrorAction SilentlyContinue
}

# UTF-8 without BOM: a BOM at the head of a Gradle script or a Capacitor JSON trips the toolchain.
function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

# cap sync regenerates the three files below on every run, so this has to run after each sync.
function Remove-BarcodeScannerPlugin([string]$AndroidDir) {
    $stamp = 'capacitor-mlkit-barcode-scanning'
    $settings = Join-Path $AndroidDir 'capacitor.settings.gradle'
    $buildGradle = Join-Path $AndroidDir 'app\capacitor.build.gradle'
    $plugins = Join-Path $AndroidDir 'app\src\main\assets\capacitor.plugins.json'

    $kept = @(Get-Content -LiteralPath $settings -Encoding UTF8) | Where-Object { $_ -notmatch $stamp }
    Write-Utf8NoBom $settings (($kept -join "`n") + "`n")

    $kept = @(Get-Content -LiteralPath $buildGradle -Encoding UTF8) | Where-Object { $_ -notmatch $stamp }
    Write-Utf8NoBom $buildGradle (($kept -join "`n") + "`n")

    $list = @(Get-Content -LiteralPath $plugins -Raw -Encoding UTF8 | ConvertFrom-Json) |
        Where-Object { $_.pkg -ne '@capacitor-mlkit/barcode-scanning' }
    Write-Utf8NoBom $plugins ((@($list) | ConvertTo-Json -Depth 5) + "`n")
}

Push-Location $frontendDir
try {
    npm run build:lite
    if ($LASTEXITCODE -ne 0) { throw 'Lite web build failed' }

    switch ($Variant) {
        'local' { node ..\scripts\catalogue\stage-media.mjs dist --lite }
        'full'  { node ..\scripts\catalogue\stage-media.mjs dist }
        'remote' {
            # 只把静态图 stage 进 dist，再把动画目录删掉（动画走 CDN）。
            node ..\scripts\catalogue\stage-media.mjs dist --lite
            $stagedClips = Join-Path $frontendDir 'dist\exercise-media\clip'
            if (Test-Path -LiteralPath $stagedClips) { Remove-Item -LiteralPath $stagedClips -Recurse -Force }
        }
    }
    if ($LASTEXITCODE -ne 0) { throw 'Media staging failed' }

    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }

    Remove-BarcodeScannerPlugin -AndroidDir $androidDir

    if ($Variant -eq 'remote') {
        # cap sync 把 dist 拷进 assets/public；上一个变体留下的动画目录要清掉，静态图保留。
        $staleClips = Join-Path $appAssetsDir 'public\exercise-media\clip'
        if (Test-Path -LiteralPath $staleClips) {
            $resolved = (Resolve-Path -LiteralPath $staleClips).Path
            $mediaDir = (Resolve-Path -LiteralPath (Join-Path $appAssetsDir 'public\exercise-media')).Path
            if (-not $resolved.StartsWith($mediaDir, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "refusing to remove a path outside assets/public/exercise-media: $resolved"
            }
            Remove-Item -LiteralPath $resolved -Recurse -Force
        }
    }

    node scripts\check-mobile-bundle.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Mobile bundle check failed' }

    & (Join-Path $androidDir 'gradlew.bat') -p $androidDir clean assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed' }
}
finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path $outputsDir | Out-Null
Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force

$apk = Get-Item -LiteralPath $apkTarget
$hash = Get-FileHash -LiteralPath $apkTarget -Algorithm SHA256

# What actually went into the package, so a variant cannot quietly be the wrong one.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($apkTarget)
try {
    $stills = @($zip.Entries | Where-Object { $_.FullName -like 'assets/public/exercise-media/still/*' }).Count
    $clips = @($zip.Entries | Where-Object { $_.FullName -like 'assets/public/exercise-media/clip/*' }).Count
    $barcode = @($zip.Entries | Where-Object { $_.FullName -like '*libbarhopper*' }).Count
}
finally {
    $zip.Dispose()
}

Write-Host ''
Write-Host "Variant: $Variant"
Write-Host "APK:     $($apk.FullName)"
Write-Host "Size:    $([math]::Round($apk.Length / 1MB, 1)) MiB"
if ($Variant -eq 'remote') {
    Write-Host "Media:   $stills stills packaged; animations fetched from $mediaRoot/clip/ at runtime"
    Write-Host "GIF:     $(($GifMirrorBase.TrimEnd('/'))) mirror for exercises with a lianji GIF"
} else {
    Write-Host "Media:   $stills stills, $clips animations packaged"
}
Write-Host "Barcode: $(if ($barcode -eq 0) { 'removed (no libbarhopper)' } else { "STILL PRESENT ($barcode)" })"
Write-Host "SHA256:  $($hash.Hash)"
