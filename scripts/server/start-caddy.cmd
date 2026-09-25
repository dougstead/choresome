@echo off
cd /d C:\Apps\choresome
caddy.exe run --config Caddyfile --adapter caddyfile
