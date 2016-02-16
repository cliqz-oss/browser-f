$(document).ready(function() {
    // Call out nondefault options
    $('<span> (not run by default)</span>')
        .addClass('info')
        .insertAfter($('.nondefault').parent());

    // Several subsections are headed by all/none selectors. Make them control
    // their dependents

    // If the all-selector is checked, then force all default items to be checked
    var suppress_loop = false;
    $('.all-selector').change(function() {
        if ($(this).prop('checked')) {
            suppress_loop = true;
            var group = $(this).closest('.option-group');
            group.find(':checkbox:not(.group-selector):not(.nondefault)')
                .prop('checked', true);
            group.find('.none-selector')
                .prop('checked', false);
            suppress_loop = false;
        }
    });

    // If the none-selector is checked, then force all items to be unchecked
    $('.none-selector').change(function() {
        if ($(this).prop('checked')) {
            suppress_loop = true;
            var group = $(this).closest('.option-group');
            group.find(':checkbox:not(.group-selector)')
                .prop('checked', false);
            group.find('.all-selector')
                .prop('checked', false);
            suppress_loop = false;
        }
    });

    // Handle subgroups (eg mochitests-all).
    $('.subgroup-all-selector').change(function() {
        if ($(this).prop('checked')) {
            $(this).closest('.option-subgroup').find(':checkbox:not(.subgroup-selector):not(.nondefault)')
                .prop('checked', true);
        }
    });

    // This must come before the regular checkboxes, so that the All selector
    // is set in time to collapse the toplevel 'all'.
    $('.option-subgroup').find(':checkbox:not(.subgroup-selector)').change(function() {
        var subgroup = $(this).closest('.option-subgroup');
        var unchecked_defaults =
            subgroup.find(':checkbox:not(.subgroup-selector):not(:checked):not(.nondefault)');
        subgroup.find('.subgroup-selector').prop('checked', unchecked_defaults.length == 0);
    });

    // Make all option-group descendant checkboxes control the group-selectors
    $('.option-group').find(':checkbox:not(.group-selector)').change(function() {
        if (suppress_loop) return;
        var group = $(this).closest('.option-group');

        var checked = group.find(':checkbox:not(.group-selector):checked');
        group.find('.none-selector').prop('checked', checked.length == 0);

        var unchecked_defaults =
            group.find(':checkbox:not(.group-selector):not(:checked):not(.nondefault)');
        group.find('.all-selector').prop('checked', unchecked_defaults.length == 0);
    });

    // Track the last change. If shift is pressed when clicking one item,
    // also apply the target state to all items in between.
    var last_changed;
    var all_items = $(':checkbox:not(.group-selector):not(.subgroup-selector)');
    $('label').filter(function(index, elem) {
        var checkbox = $(elem).children(':checkbox');
        return checkbox.not('.group-selector, .subgroup-selector').size() > 0;
    }).mouseup(function(evt) {
        if (evt.shiftKey && last_changed >= 0) {
            var checkbox = $(this).children(':checkbox');
            var checked = !checkbox.prop('checked');
            var index = all_items.index(checkbox);
            var items;
            if (last_changed < index) {
                items = all_items.slice(last_changed + 1, index + 1);
            } else if (last_changed > index) {
                items = all_items.slice(index, last_changed);
            }
            if (items) {
                // Use setTimeout to override the state of checkboxes to
                // work around difference of default behavior between
                // different browsers.
                // More specifically, on Firefox, any click on checkboxs
                // flips the state, while click on labels takes effect
                // only if no modifier key is pressed. While on Chrome,
                // any click on both elements always takes effect.
                setTimeout(() => {
                    items.prop('checked', checked);
                    setresult();
                }, 0);
            }
        }
    });

    // Force initial update
    $('.all-selector:checked').change();
    $('.none-selector:checked').change();

    // Selecting anything should update the try syntax
    $(':checkbox').change(function() {
        last_changed = all_items.index(this);
        setresult();
    });
    $(':radio').change(setresult);
    $(':text').change(setresult);

    // Initialize the try syntax
    setresult();
});

function resolveFilters(filters) {
    // The linux32 hack requires cancelling out mutually-exclusive options
    var want = {};
    for (var i in filters) {
        if (filters[i].charAt(0) != '-') {
            want[filters[i]] = true;
        }
    }
    for (var i in filters) {
        if (filters[i].charAt(0) == '-') {
            var name = filters[i].substring(1);
            if (name in want)
                delete want[name];
            else
                want[filters[i]] = true;
        }
    }
    return Object.keys(want);
}

function setresult() {
    var args = [];

    $('.option-radio[try-section]').each(function() {
        var arg = '-' + $(this).attr('try-section') + ' ';
        arg += $(this).find(':checked').attr('value');
        args.push(arg);
    });

    $('.option-email').each(function() {
        var arg = $(this).find(':checked').attr('value');
        if (arg != 'on')
            args.push(arg);
    });

    var have_projects = {};
    $('.option-group[try-section]').each(function() {
        var tryopt = $(this).attr('try-section');
        var arg = '-' + tryopt + ' ';
        var names = [];
        if ($(this).find('.none-selector:checked').length > 0) {
            names = ['none'];
        } else if ($(this).find('.all-selector:checked').length > 0) {
            names = ['all'];
        } else {
            var group = $(this).closest('.option-group');
            var options = group.find(':checked:not(.group-selector):not(.subgroup-selector):not(.nondefault)');
            group.find('.subgroup-all-selector:checked').each(function(i, elm) {
                options = options.add($(elm));
                var subgroup = $(this).closest('.option-subgroup');
                options = options.not(subgroup.find(':checked:not(.group-selector):not(.subgroup-selector):not(.nondefault)'))
            })
            options.each(function(i,elt){
                names.push($(elt).attr('value'));
                var project = $(elt).attr('data-project');
                if (project)
                    have_projects[project] = true;
            });
        }

        // Add in the nondefault builders
        $(this).find(':checked.nondefault').each(function(i,elt) {
            names.push($(elt).attr('value'));
        });

        var filters = [];
        var filter_tryopt = tryopt == 't' ? 'u' : tryopt;
        $('[try-filter=' + filter_tryopt + '] :checked').each(function () {
            filters.push.apply(filters, $(this).attr('value').split(','));
        });
        if (filters.length > 0) {
            filters = resolveFilters(filters).join(',');
            names = names.map(function (n) { return n + '[' + filters + ']'; });
        }

        arg += names.join(',');
        args.push(arg);
    });

    if ($('.profile').is(':checked')) {
        args.push('mozharness: --spsProfile');
    }

    if ($('.no-retry').is(':checked')) {
        args.push('--no-retry');
    }

    if ($('.rebuild-talos').is(':checked')) {
        args.push('--rebuild-talos 5');
    }

    var tag = $('.tags').val();
    if (tag) {
        args.push('--tag ' + tag);
    }

    var rebuilds = parseInt($('.rebuilds').val(), 10);
    if (rebuilds) {
        args.push('--rebuild ' + rebuilds);
    }

    var value = args.join(' ');
    var incomplete = false;

    if (value.match(/-b none/)) {
        $('#build_type-none').addClass('attention')
        incomplete = true;
    } else {
        $('#build_type-none').removeClass('attention')
    }

    if (value.match(/-p none/)) {
        $('#platforms-none').addClass('attention');
        incomplete = true;
    } else {
        $('#platforms-none').removeClass('attention');
    }

    if (incomplete) {
        value = "(NO JOBS CHOSEN)";
        $('.result').val(value);
    } else {
        $('#result_try').val('try: ' + value);
        $('#result_mach').val('mach try ' + value);
    }
}
