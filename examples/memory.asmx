
@function main(int argc, char[] argv) {
    @call malloc(210);

    @call malloc(65532);
    @push $ax;
    @system 4;

    @call free($ax);

    @call sizeof($ax);
    @push $eax;
    @system 4;

    @call sizeof(sizeof(uint8));
    @push $eax;
    @system 4;

    @call calloc(10, sizeof(sizeof(uint16)));
    @push $ax;
    @system 4;

    @call mem_free($ax);

    @call sizeof($eax);
    @push $eax;
    @system 4;

    @push "Great Success! 🔥";
    @system 4;
};
