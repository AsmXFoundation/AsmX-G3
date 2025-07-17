
@function main {
    ;; to go to the GPU mode
    @mode 1

    ;; set window x and y to 0
    @mov $wdx, 0
    @mov $wdy, 0
    
    ;; set window width and height
    @mov $wsw, 800
    @mov $wsh, 600

    ;; to go to the CPU mode (default mode)
    @mode 0
}
