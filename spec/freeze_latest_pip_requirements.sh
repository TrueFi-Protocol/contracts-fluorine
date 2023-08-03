
freeze_latest_pip_requirements() {
    while read line ; do
        local latest_version="$(extract_version "$(pip3 index versions $line)")"
        if [[ -z "$latest_version" ]]; then
            echo "$line"
        else
            echo "$line==$latest_version"
        fi
    done
}

extract_version() {
    local text="$1"

    BASH_REMATCH=""
    [[ "${text}" =~ [0-9\.]+ ]]
    echo "${BASH_REMATCH}"
}

main() {
    freeze_latest_pip_requirements <spec/docker/requirements.txt >./build/requirements-frozen.txt
}

main "$@"
