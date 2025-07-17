
@label _end {
    @system 1;
}

@label memory_print {
    @cmp $imm0, 1
    @jle _end
    @push [$imm1]
    @system 4
    @dec $imm0
    @inc $imm1
    @jmp memory_print
}

@function main {
    @store $mm0, uint16 [120] ;; $mm0 = [120, 0x00, 0x00, 0x00]  $mmi0 = 0x01
    @store $mm0, uint16 [120] ;; $mm0 = [120, 120, 0x00, 0x00]   $mmi0 = 0x02
    @store $mm0, uint16 [120] ;; $mm0 = [120, 120, 120, 0x00]    $mmi0 = 0x03
    @store $mm0, uint16 [120] ;; $mm0 = [120, 120, 120, 120]     $mmi0 = 0x04

    @push $mm0
    @system 4                 ;; output: $mm0 = [120, 120, 120, 120]

    @mov $imm0, 50
    @mov $imm1, 0
    @goto memory_print;
}