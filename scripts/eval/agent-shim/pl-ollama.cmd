@echo off
setlocal
if "%PL_REAL_BIN_OLLAMA%"=="" (
  echo [pl-ollama] PL_REAL_BIN_OLLAMA is not set 1>&2
  exit /b 2
)
set "PL_REAL_BIN=%PL_REAL_BIN_OLLAMA%"
set "PL_SHIM_NAME=ollama"
node "%~dp0pl-agent-shim.mjs" %*
