@echo off
setlocal
rem 用法：build-apk.cmd            构建全部三个版本（remote / local / full）
rem       build-apk.cmd remote     只构建某个版本（remote|local|full）
if "%~1"=="" (
  set "VARIANTS=remote local full"
) else (
  set "VARIANTS=%*"
)
for %%V in (%VARIANTS%) do (
  echo.
  echo === 构建 %%V ===
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-lite-apk.ps1" -Variant %%V
  if errorlevel 1 goto failed
)
echo.
echo APK build finished.
goto end
:failed
echo.
echo APK build failed.
:end
pause
