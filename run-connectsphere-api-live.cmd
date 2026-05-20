@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-connectsphere-api-live.ps1" > "%~dp0api-cmd-runner.log" 2>&1
