@echo off
rem Windows forwarder for the claude binary.
rem Reads PL_REAL_BIN_CLAUDE and invokes the shim under that identity.
setlocal
if "%PL_REAL_BIN_CLAUDE%"=="" (
  echo [pl-claude] PL_REAL_BIN_CLAUDE is not set 1>&2
  exit /b 2
)
set "PL_REAL_BIN=%PL_REAL_BIN_CLAUDE%"
set "PL_SHIM_NAME=claude"
node "%~dp0pl-agent-shim.mjs" %*
