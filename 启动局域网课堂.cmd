@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "output\斜面课堂局域网版\启动课堂.cmd" (
  echo 正在首次制作局域网课堂，请稍候……
  call npm.cmd run build:lan
  if errorlevel 1 (
    echo 制作失败，请保留本窗口并联系技术人员。
    pause
    exit /b 1
  )
)
call "output\斜面课堂局域网版\启动课堂.cmd"
