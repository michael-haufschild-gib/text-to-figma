@echo off
REM ============================================================================
REM Build All Components - Text-to-Figma Project (Windows)
REM
REM This script builds all components of the Text-to-Figma system:
REM - MCP Server (TypeScript to JavaScript)
REM - Figma Plugin (TypeScript to JavaScript)
REM - WebSocket Server (no build needed, pure JavaScript)
REM - Tests (no build needed)
REM
REM Usage: build-all.bat
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ===================================================================
echo   Text-to-Figma Build System (Windows)
echo ===================================================================
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    exit /b 1
)

REM Get the project root directory
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo [INFO] Project root: %PROJECT_ROOT%

REM ============================================================================
REM Step 1: Install dependencies
REM ============================================================================

echo.
echo ===================================================================
echo   Step 1: Installing Dependencies
echo ===================================================================
echo.

echo [INFO] Installing root dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install root dependencies
    exit /b 1
)
echo [SUCCESS] Root dependencies installed

echo [INFO] Installing MCP server dependencies...
cd /d "%PROJECT_ROOT%mcp-server"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install MCP server dependencies
    exit /b 1
)
echo [SUCCESS] MCP server dependencies installed

echo [INFO] Installing WebSocket server dependencies...
cd /d "%PROJECT_ROOT%websocket-server"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install WebSocket server dependencies
    exit /b 1
)
echo [SUCCESS] WebSocket server dependencies installed

echo [INFO] Installing Figma plugin dependencies...
cd /d "%PROJECT_ROOT%figma-plugin"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install Figma plugin dependencies
    exit /b 1
)
echo [SUCCESS] Figma plugin dependencies installed

echo [INFO] Installing test dependencies...
cd /d "%PROJECT_ROOT%tests"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install test dependencies
    exit /b 1
)
echo [SUCCESS] Test dependencies installed

REM ============================================================================
REM Step 2: Build TypeScript components
REM ============================================================================

echo.
echo ===================================================================
echo   Step 2: Building TypeScript Components
echo ===================================================================
echo.

echo [INFO] Building MCP server...
cd /d "%PROJECT_ROOT%mcp-server"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build MCP server
    exit /b 1
)
echo [SUCCESS] MCP server built (dist folder)

echo [INFO] Building Figma plugin...
cd /d "%PROJECT_ROOT%figma-plugin"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build Figma plugin
    exit /b 1
)
echo [SUCCESS] Figma plugin built (code.js)

echo [INFO] WebSocket server (pure JavaScript, no build needed)
echo [SUCCESS] WebSocket server ready

REM ============================================================================
REM Step 3: Verify builds
REM ============================================================================

echo.
echo ===================================================================
echo   Step 3: Verifying Builds
echo ===================================================================
echo.

if exist "%PROJECT_ROOT%mcp-server\dist\index.js" (
    echo [SUCCESS] MCP server build verified
) else (
    echo [ERROR] MCP server build failed - dist\index.js not found
    exit /b 1
)

if exist "%PROJECT_ROOT%figma-plugin\code.js" (
    echo [SUCCESS] Figma plugin build verified
) else (
    echo [ERROR] Figma plugin build failed - code.js not found
    exit /b 1
)

if exist "%PROJECT_ROOT%websocket-server\server.js" (
    echo [SUCCESS] WebSocket server verified
) else (
    echo [ERROR] WebSocket server missing - server.js not found
    exit /b 1
)

REM ============================================================================
REM Step 4: Run type checks
REM ============================================================================

echo.
echo ===================================================================
echo   Step 4: Running Type Checks
echo ===================================================================
echo.

echo [INFO] Type-checking MCP server...
cd /d "%PROJECT_ROOT%mcp-server"
call npm run type-check
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] MCP server type check failed
    exit /b 1
)
echo [SUCCESS] MCP server types OK

echo [INFO] Type-checking Figma plugin...
cd /d "%PROJECT_ROOT%figma-plugin"
call npm run type-check
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Figma plugin type check failed
    exit /b 1
)
echo [SUCCESS] Figma plugin types OK

REM ============================================================================
REM Summary
REM ============================================================================

cd /d "%PROJECT_ROOT%"

echo.
echo ===================================================================
echo   Build Complete!
echo ===================================================================
echo.

echo All components built successfully:
echo.
echo   - MCP Server       : mcp-server\dist\
echo   - Figma Plugin     : figma-plugin\code.js
echo   - WebSocket Server : websocket-server\server.js
echo.
echo Next steps:
echo.
echo   1. Start the WebSocket server:
echo      cd websocket-server
echo      npm start
echo.
echo   2. Start the MCP server (new command prompt):
echo      cd mcp-server
echo      npm start
echo.
echo   3. Load the Figma plugin:
echo      Figma -^> Plugins -^> Development -^> Import plugin from manifest
echo      Select: figma-plugin\manifest.json
echo.
echo For detailed instructions, see: USER_GUIDE.md
echo.

endlocal
