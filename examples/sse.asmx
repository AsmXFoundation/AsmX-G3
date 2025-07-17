
@function main {
    @storeft $xmm0, float64 [18446744073709552000]
    @storeft $xmm0, float64 [18446744073709552000]

    @push $xmm0
    @system 4

    @push $xmmi0
    @system 4

    @mov $xmmi0, 0

    @storeft $xmm0, float32 [120]
    @storeft $xmm0, float32 [125]
    @storeft $xmm0, float32 [150]
    @storeft $xmm0, float32 [155]

    @push $xmm0
    @system 4
}
