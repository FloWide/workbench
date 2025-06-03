#!/bin/bash


UUID=$(cat /proc/sys/kernel/random/uuid)
WATCHDOG_FILE="/tmp/${UUID}.watchdog"
WATCHDOG_TIMEOUT=${WATCHDOG_TIMEOUT:-10}
PID_FILE="/tmp/${UUID}.pid"

echoerr() {
    echo "$@" 1>&2
}

check_watchdog_timeout() {
    if [ ! -f "$WATCHDOG_FILE" ]; then
        touch "$WATCHDOG_FILE"
        return 0
    fi


    local file_mod_time=$(stat -c %Y "$WATCHDOG_FILE")
    local current_time=$(date +%s)
    local time_diff=$((current_time - file_mod_time))

    if [ $time_diff -gt $WATCHDOG_TIMEOUT ]; then
        return 1
    fi
}

run_process() {
    export WATCHDOG_FILE=$WATCHDOG_FILE
    exec "$@" & > /dev/stdout
    echo $! >> $PID_FILE
}

sigterm_handler() {
    SIGNAL=$1
    echoerr "[WATCHDOG] Caught signal: $SIGNAL. Exiting."

    if [[ -f $PID_FILE ]]; then
        kill -9 "$(cat "$PID_FILE")" 2>/dev/null
        rm -f "$PID_FILE"
    fi

    case "$SIGNAL" in
        SIGINT) exit 130 ;;   # 128 + 2
        SIGTERM) exit 143 ;;  # 128 + 15
        *) exit 1 ;;
    esac
}


echoerr "[WATCHDOG] Running with watchdog"
echoerr "[WATCHDOG] Timeout: $WATCHDOG_TIMEOUT seconds"
echoerr "[WATCHDOG] Watchdog file: $WATCHDOG_FILE"

run_process $@

trap 'sigterm_handler SIGINT' SIGINT
trap 'sigterm_handler SIGTERM' SIGTERM

while true; do
    # Check if process is still running
    if ! kill -0 $(cat $PID_FILE) 2>/dev/null; then
        echoerr "[WATCHDOG] Monitored process has exited. Exiting watchdog."
        rm -f $PID_FILE
        exit 0
    fi

    if ! check_watchdog_timeout; then
        echoerr "[WATCHDOG] Watchdog timeout exceeded. Restarting process."
        kill -9 $(cat $PID_FILE) 2>/dev/null
        run_process $@
    fi

    sleep 10
done

