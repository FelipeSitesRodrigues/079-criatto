@echo off
rem Abre o site da Criatto Construtora no navegador (servidor local na porta 3079).
cd /d "%~dp0"
start "" http://localhost:3079
node scripts\serve.mjs 3079
