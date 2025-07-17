
@label _factorial {
    @push "end of factorial";
    @system 4;
    @push "factorial (n): ";
    @system 3;
    @push $eax;
    @system 3;
    @system 1;
}

@label factorial {
    @cmp $ecx, 1;
    @jle _factorial;
    @mul $eax, $ecx;
    @dec $ecx;
    @jmp factorial;
}

@function main {
    @mov $ecx, 5;
    @mov $eax, 1;
    @goto factorial;
}
