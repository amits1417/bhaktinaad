@echo off
title Bhakti Naad Devotional Web Server
echo ===================================================
echo           BHAKTI NAAD LOCAL WEB SERVER
echo ===================================================
echo.
echo Launching local server on http://localhost:8080/
echo (Please keep this command window open while listening)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
echo.
echo Server stopped.
pause
