#!/usr/bin/env bash
# Launch Figma Desktop with Chromium's Local Network Access check for WebSockets disabled.
#
# Fallback only. Use it when the plugin console shows net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS.
# Figma 126.9 already starts with --disable-features=LocalNetworkAccessChecks, which also lets
# plugin WebSockets reach localhost, so current builds do not need this script. A plugin that
# stays "Disconnected" while the bridge runs is a different problem (see README troubleshooting).
#
# Disabling only LocalNetworkAccessChecksWebSockets keeps Local Network Access checks for fetch,
# XHR and frame navigations. Figma's own app.relaunch() reuses the original arguments, but
# launching from the Dock, Spotlight or an auto-update does not.
#
# Usage: launch-figma.sh [--restart]
#   --restart  Quit a running Figma that lacks the switch, then relaunch it with the switch.
set -euo pipefail

readonly FEATURE_SWITCH='--disable-features=LocalNetworkAccessChecksWebSockets'
readonly APP_NAME='Figma'
readonly WAIT_SECONDS=30

restart=false
case "${1:-}" in
  --restart) restart=true ;;
  '') ;;
  *)
    echo "Usage: $0 [--restart]" >&2
    exit 2
    ;;
esac

if [[ "$(uname -s)" != 'Darwin' ]]; then
  echo 'launch-figma.sh supports macOS only. On Windows, start Figma.exe with:' >&2
  echo "  ${FEATURE_SWITCH}" >&2
  exit 1
fi

figma_pid() {
  pgrep -x "${APP_NAME}" | head -n 1 || true
}

has_switch() {
  ps -o command= -p "$1" | grep -qF -- "${FEATURE_SWITCH}"
}

running_pid="$(figma_pid)"
if [[ -n "${running_pid}" ]]; then
  if has_switch "${running_pid}"; then
    echo "Figma is already running with ${FEATURE_SWITCH}."
    exit 0
  fi

  if [[ "${restart}" != true ]]; then
    echo 'Figma is running without the WebSocket switch.' >&2
    echo 'Quit Figma and run this command again, or rerun it with --restart.' >&2
    exit 1
  fi

  echo 'Quitting Figma...'
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null
  for _ in $(seq "${WAIT_SECONDS}"); do
    [[ -z "$(figma_pid)" ]] && break
    sleep 1
  done
  if [[ -n "$(figma_pid)" ]]; then
    echo "Figma did not quit within ${WAIT_SECONDS}s. Check for an unsaved-changes dialog." >&2
    exit 1
  fi
fi

open -a "${APP_NAME}" --args "${FEATURE_SWITCH}"

for _ in $(seq "${WAIT_SECONDS}"); do
  launched_pid="$(figma_pid)"
  if [[ -n "${launched_pid}" ]]; then
    if has_switch "${launched_pid}"; then
      echo "Figma started with ${FEATURE_SWITCH}. Run the Text-to-Figma plugin to connect."
      exit 0
    fi
    echo 'Figma started without the WebSocket switch.' >&2
    exit 1
  fi
  sleep 1
done

echo "Figma did not start within ${WAIT_SECONDS}s." >&2
exit 1
