@echo off
rem What the "Choresome Hosted" scheduled task runs. Applies pending
rem migrations, then serves on PORT from .env.hosted (see setup-hosted.ps1).
cd /d "%~dp0..\..\.."
node --env-file=.env.hosted scripts\start-hosted.mjs
