@echo off
setlocal
if "%PL_REAL_BIN_GEMINI%"=="" (
  echo [pl-gemini] PL_REAL_BIN_GEMINI is not set 1>&2
  exit /b 2
)
set "PL_REAL_BIN=%PL_REAL_BIN_GEMINI%"
set "PL_SHIM_NAME=gemini"
node "%~dp0pl-agent-shim.mjs" %*
