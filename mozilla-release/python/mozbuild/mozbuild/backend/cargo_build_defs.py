# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, unicode_literals

cargo_extra_outputs = {
    'bindgen': [
        'tests.rs',
        'host-target.txt',
    ],
    'cssparser': [
        'tokenizer.rs',
    ],
    'gleam': [
        'gl_and_gles_bindings.rs',
        'gl_bindings.rs',
        'gles_bindings.rs',
    ],
    'khronos_api': [
        'webgl_exts.rs',
    ],
    'libloading': [
        'libglobal_static.a',
        'src/os/unix/global_static.o',
    ],
    'selectors': [
        'ascii_case_insensitive_html_attributes.rs',
    ],
    'style': [
        'gecko/atom_macro.rs',
        'gecko/bindings.rs',
        'gecko/pseudo_element_definition.rs',
        'gecko/structs.rs',
        'gecko_properties.rs',
        'longhands/background.rs',
        'longhands/border.rs',
        'longhands/box.rs',
        'longhands/color.rs',
        'longhands/column.rs',
        'longhands/counters.rs',
        'longhands/effects.rs',
        'longhands/font.rs',
        'longhands/inherited_box.rs',
        'longhands/inherited_svg.rs',
        'longhands/inherited_table.rs',
        'longhands/inherited_text.rs',
        'longhands/inherited_ui.rs',
        'longhands/list.rs',
        'longhands/margin.rs',
        'longhands/outline.rs',
        'longhands/padding.rs',
        'longhands/position.rs',
        'longhands/svg.rs',
        'longhands/table.rs',
        'longhands/text.rs',
        'longhands/ui.rs',
        'longhands/xul.rs',
        'properties.rs',
        'shorthands/background.rs',
        'shorthands/border.rs',
        'shorthands/box.rs',
        'shorthands/color.rs',
        'shorthands/column.rs',
        'shorthands/counters.rs',
        'shorthands/effects.rs',
        'shorthands/font.rs',
        'shorthands/inherited_box.rs',
        'shorthands/inherited_svg.rs',
        'shorthands/inherited_table.rs',
        'shorthands/inherited_text.rs',
        'shorthands/inherited_ui.rs',
        'shorthands/list.rs',
        'shorthands/margin.rs',
        'shorthands/outline.rs',
        'shorthands/padding.rs',
        'shorthands/position.rs',
        'shorthands/svg.rs',
        'shorthands/table.rs',
        'shorthands/text.rs',
        'shorthands/ui.rs',
        'shorthands/xul.rs',
    ],
    'webrender': [
        'shaders.rs',
    ],
}

cargo_extra_flags = {
    'style': [
        '-l', 'static=global_static',
        '-L', 'native=%(libloading_outdir)s',
    ]
}
