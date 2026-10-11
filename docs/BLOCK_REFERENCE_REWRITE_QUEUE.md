# Block reference rewrite queue

Canonical manifest: `prompts/blocks/manifest.json`, 202 entries.

Entries 1–63 are preserved unchanged. The following are individually rewritten and schema-checked; AI image quality is not yet visually validated.

## Completed — first 20

- [x] 64. `mcl_core_frosted_ice_0.png` — `tex_6f8775a783`
- [x] 65. `mcl_core_frosted_ice_1.png` — `tex_19870d6f6b`
- [x] 66. `mcl_core_frosted_ice_2.png` — `tex_9ab3930f45`
- [x] 67. `mcl_core_frosted_ice_3.png` — `tex_0be3faf0c4`
- [x] 68. `mcl_core_glass_black.png` — `tex_0ad5b44126`
- [x] 69. `mcl_core_glass_black_detail.png` — `tex_2a23481025`
- [x] 70. `mcl_core_glass_blue.png` — `tex_ccdff60625`
- [x] 71. `mcl_core_glass_blue_detail.png` — `tex_c6fbf57802`
- [x] 72. `mcl_core_glass_brown.png` — `tex_5c49040f98`
- [x] 73. `mcl_core_glass_brown_detail.png` — `tex_563e29a494`
- [x] 74. `mcl_core_glass_cyan.png` — `tex_49aaa1ba5a`
- [x] 75. `mcl_core_glass_cyan_detail.png` — `tex_c345e6ab75`
- [x] 76. `mcl_core_glass_gray.png` — `tex_af49416fd2`
- [x] 77. `mcl_core_glass_gray_detail.png` — `tex_63e84376f0`
- [x] 78. `mcl_core_glass_green.png` — `tex_896996d185`
- [x] 79. `mcl_core_glass_green_detail.png` — `tex_d720838421`
- [x] 80. `mcl_core_glass_light_blue.png` — `tex_bcd7920314`
- [x] 81. `mcl_core_glass_light_blue_detail.png` — `tex_8eb6720383`
- [x] 82. `mcl_core_glass_lime.png` — `tex_3d66b726f3`
- [x] 83. `mcl_core_glass_lime_detail.png` — `tex_37f60ce525`

## Next — 119 remaining

Continue at manifest order 84 through 202, one individually authored reference at a time. Confirm source semantics and parent/variant relationship before marking done.

## Constraints

- Do not replace successful early material prompts or existing user edits.
- Each variant must preserve its source color and material identity; detail layers are subordinate to matching base layers.
- Template repetition and excessive sharpness are disallowed.
- The global Image A / Image B production prompt and locked-parent behavior are separate tasks, not fixed by this batch.
