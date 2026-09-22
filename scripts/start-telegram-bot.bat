@echo off
cd /d "%~dp0.."
npm run telegram:bot >> "%~dp0telegram-bot.log" 2>&1
