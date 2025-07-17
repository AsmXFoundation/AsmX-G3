
@function main {
    ;; to go to the RTC mode
    @mode 2

    @call get_seconds();
    @push $eax
    @system 3
    @push " "
    @system 4

    ;; to go to the CPU mode (default mode)
    @mode 0
}
