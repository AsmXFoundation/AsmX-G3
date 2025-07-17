
@function main {
    @mov $eax, 14
    @push $eax
    @system 4 ;; 0x0000000e

    @mov $ebx, $eax

    @call calloc(4, sizeof(uint8))
    @push $ax
    @system 4 ;; <ptr *>

    @mov $eax, $ebx
    @push $eax
    @system 4 ;; 0x0000000e

    @movzx $eax, 65535
    @push $eax
    @system 4 ;; 0x0000ffff

    @movsx $ax, 139
    @push $ax
    @system 4 ;; 0x0000ff8b

    @movsx $ax, 10
    @push $ax
    @system 4 ;; 0x0000fffa
}
