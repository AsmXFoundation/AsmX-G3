
@label pow {
    @mov $eax, $imm0
    @mul $eax
}


@function main {
    @mov $imm0, 10
    @goto pow
    @push $eax
    @system 4
} 

