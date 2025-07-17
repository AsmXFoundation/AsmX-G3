
@function main(int argc, char[] argv) {
    @mov $eax, 14;
    @push $eax;
    @system 4;

    @mov $ax, 5;
    @mov $eax, $ax;
    @push $eax;
    @system 4;

    @call malloc(10);
    @mov $eax, [$ax];
    @push $eax;
    @system 4;

    @mov $eax, 6356346;
    @push $eax;
    @system 4;

    @mov $eax, $eax;
    @push $eax;
    @system 4;
}
