@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在制作局域网课堂……
call npm.cmd run build:lan
if errorlevel 1 (
  echo 制作失败，请保留本窗口并联系技术人员。
  pause
  exit /b 1
)
echo 制作完成：output\斜面课堂局域网版
pause
