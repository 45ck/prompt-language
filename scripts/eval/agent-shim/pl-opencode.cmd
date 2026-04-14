@echo off
setlocal
if "%PL_REAL_BIN_OPENCODE%"=="" (
  echo [pl-opencode] PL_REAL_BIN_OPENCODE is not set 1>&2
  exit /b 2
)
set "PL_REAL_BIN=%PL_REAL_BIN_OPENCODE%"
set "PL_SHIM_NAME=opencode"
node "%~dp0pl-agent-shim.mjs" %*
