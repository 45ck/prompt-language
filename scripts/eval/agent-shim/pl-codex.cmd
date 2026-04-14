@echo off
setlocal
if "%PL_REAL_BIN_CODEX%"=="" (
  echo [pl-codex] PL_REAL_BIN_CODEX is not set 1>&2
  exit /b 2
)
set "PL_REAL_BIN=%PL_REAL_BIN_CODEX%"
set "PL_SHIM_NAME=codex"
node "%~dp0pl-agent-shim.mjs" %*
