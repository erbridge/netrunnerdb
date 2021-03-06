var InputByTitle = false;
var DisplayColumns = 1;
var CoreSets = 3;
var Buttons_Behavior = 'cumulative';
var Snapshots = []; // deck contents autosaved
var Autosave_timer = null;
var Deck_changed_since_last_autosave = false;
var Autosave_running = false;
var Autosave_period = 60;

$(document).on('data.app', function() {
	var localStorageDisplayColumns;
	if (localStorage
			&& (localStorageDisplayColumns = parseInt(localStorage
					.getItem('display_columns'), 10)) !== null
			&& [ 1, 2, 3 ].indexOf(localStorageDisplayColumns) > -1) {
		DisplayColumns = localStorageDisplayColumns;
	}
	$('input[name=display-column-' + DisplayColumns + ']')
			.prop('checked', true);

	var localStorageCoreSets;
	if (localStorage
			&& (localStorageCoreSets = parseInt(localStorage
					.getItem('core_sets'), 10)) !== null
			&& [ 1, 2, 3 ].indexOf(localStorageCoreSets) > -1) {
		CoreSets = localStorageCoreSets;
	}
	$('input[name=core-set-' + CoreSets + ']').prop('checked', true);

	var localStorageSuggestions;
	if (localStorage
			&& (localStorageSuggestions = parseInt(localStorage
					.getItem('show_suggestions'), 10)) !== null
			&& [ 0, 3, 10 ].indexOf(localStorageSuggestions) > -1) {
		NRDB.suggestions.number = localStorageSuggestions;
	}
	$('input[name=show-suggestions-' + NRDB.suggestions.number + ']').prop('checked', true);

	var localStorageButtonsBehavior;
	if (localStorage
			&& (localStorageButtonsBehavior = localStorage.getItem('buttons_behavior')) !== null
			&& [ 'cumulative', 'exclusive' ].indexOf(localStorageButtonsBehavior) > -1) {
		Buttons_Behavior = localStorageButtonsBehavior;
	}
	$('input[name=buttons-behavior-' + Buttons_Behavior + ']').prop('checked', true);

	NRDB.data.cards.remove({
		side_code : {
			"$ne" : Side
		}
	});
	
	var sets_in_deck = {};
	NRDB.data.cards.find().forEach(function(card) {
		var indeck = 0;
		if (Deck[card.code]) {
			indeck = parseInt(Deck[card.code], 10);
			sets_in_deck[card.pack_code] = 1;
		}
		NRDB.data.cards.updateById(card.code, {
			indeck : indeck,
			factioncost : card.faction_cost || 0
		});
	});
	
	update_deck();
	
	NRDB.draw_simulator.init();
	
	NRDB.data.cards.find().forEach(function(card) {
		var max_qty = card.deck_limit;
		if(card.pack_code == 'core') {
			max_qty = Math.min(card.quantity * CoreSets, max_qty);
		}
		if(Identity.pack_code == "draft") {
			max_qty = 9;
		}
		NRDB.data.cards.updateById(card.code, {
			maxqty : max_qty
		});
	});
	
	$('#faction_code').empty();
	
	var factions = NRDB.data.factions.find({side_code: Side}).sort(function(a, b) {
		return b.code.substr(0,7) === "neutral" 
			? -1
			: a.code.substr(0,7) === "neutral" 
				? 1 
				: a.code.localeCompare(b.code);
	});
	factions.forEach(function(faction) {
		var label = $('<label class="btn btn-default btn-sm" data-code="' + faction.code
				+ '" title="'+faction.name+'"><input type="checkbox" name="' + faction.code
				+ '"><img src="'
				+ Url_FactionImage.replace('xxx', faction.code)
				+ '" style="height:12px" alt="'+faction.code+'"></label>');
		label.tooltip({container: 'body'});
		$('#faction_code').append(label);
	});
	
	$('#faction_code').button();
	$('#faction_code').children('label[data-code='+Identity.faction_code+']').each(function(index, elt) {
		$(elt).button('toggle');
	});

	$('#type_code').empty();
	var types = NRDB.data.types.find({
		is_subtype:false,
		'$or': [{
			side_code: Identity.side_code
		},{
			side_code: null
		}]
	}).sort();
	types.forEach(function(type) {
		var label = $('<label class="btn btn-default btn-sm" data-code="'
				+ type.code + '" title="'+type.name+'"><input type="checkbox" name="' + type.code
				+ '"><img src="' + Url_TypeImage.replace('xxx', type.code)
				+ '" style="height:12px" alt="'+type.code+'"></label>');
		label.tooltip({container: 'body'});
		$('#type_code').append(label);
	});
	$('#type_code').button();
	$('#type_code').children('label:first-child').each(function(index, elt) {
		$(elt).button('toggle');
	});

	$('#pack_code').empty();
	NRDB.data.packs.find().sort(function (a, b) {
		return (a.cycle.position - b.cycle.position) || (a.position - b.position);
	}).forEach(function(pack) {
		var is_checked = pack.date_release || sets_in_deck[pack.code];
		$('#pack_code').append(
			'<div class="checkbox"><label><input type="checkbox" name="' + pack.code + '"' + (is_checked ? ' checked="checked"' : '')+ '>' + pack.name + '</label></div>');
	});

	$('#prebuilt_code').empty();
	NRDB.data.prebuilts.find().sort(function (a, b) {
		return (a.position - b.position);
	}).forEach(function(prebuilt) {
		var checked = prebuilt.date_release === "" ? '' : ' checked="checked"';
		$('#prebuilt_code').append(
			'<div class="checkbox"><label><input type="checkbox" name="' + prebuilt.code + '"' + checked + '>' + prebuilt.name + '</label></div>');
	});

	$('input[name=Identity]').prop("checked", false);
	if (Identity.code == "03002") {
		$('input[name=Jinteki]').prop("checked", false);
	}
		
	$('.filter').each(function(index, div) {
		var columnName = $(div).attr('id');
		var arr = [], checked;
		$(div).find("input[type=checkbox]").each(function(index, elt) {
			var name = $(elt).attr('name');
			if(columnName == "pack_code" && localStorage && (checked = localStorage.getItem('pack_code_'+ name)) !== null) {
				$(elt).prop('checked', checked === "on");
			}
			if(columnName == "prebuilt_code" && localStorage && (checked = localStorage.getItem('prebuilt_code_'+ name)) !== null) {
				$(elt).prop('checked', checked === "on");
			}
			if($(elt).prop('checked')) {
				arr.push(name);
			}
		});
		Filters[columnName] = arr;
	});
	
	FilterQuery = get_filter_query(Filters);

	$('#mwl_code').trigger('change');
	// triggers a refresh_collection();
	// triggers a update_deck();


	function findMatches(q, cb) {
		if(q.match(/^\w:/)) return;
		var regexp = new RegExp(q, 'i');
		cb(NRDB.data.cards.find({title: regexp}));
	}

	$('#filter-text').typeahead({
		  hint: true,
		  highlight: true,
		  minLength: 2
		},{
		displayKey: 'title',
		source: findMatches
	});

	make_cost_graph();
	make_strength_graph();

	$.each(History, function (index, snapshot) {
		add_snapshot(snapshot);
	});

	$('html,body').css('height', 'auto');

});

function get_filter_query(Filters) {
	var FilterQuery = _.pickBy(Filters);
	
	// we're including some packs and some prebuilts (normal situation)
	// it's an OR situation: cards are available if they are in the packs selected OR in the prebuilt selected
	if(FilterQuery.prebuilt_code && FilterQuery.pack_code) {

		var cards_in_prebuilts = _.flatten(FilterQuery.prebuilt_code.map(function (prebuilt_code) {
			var prebuilt = NRDB.data.prebuilts.findById(prebuilt_code);
			return _.keys(prebuilt.cards)
		}));
		
		FilterQuery['$or'] = [{
			pack_code: FilterQuery.pack_code
		}, {
			code: {
				'$in': cards_in_prebuilts
			}
		}];
		
		delete(FilterQuery.pack_code);
		delete(FilterQuery.prebuilt_code);
	}

	return FilterQuery;
}

function uncheck_all_others() {
	$(this).closest(".filter").find("input[type=checkbox]").prop("checked",false);
	$(this).children('input[type=checkbox]').prop("checked", true).trigger('change');
}

function check_all_others() {
	$(this).closest(".filter").find("input[type=checkbox]").prop("checked",true);
	$(this).children('input[type=checkbox]').prop("checked", false);
}

function uncheck_all_active() {
	$(this).closest(".filter").find("label.active").button('toggle');
}

function check_all_inactive() {
	$(this).closest(".filter").find("label:not(.active)").button('toggle');
}

$(function() {
	// while editing a deck, we don't want to leave the page if the deck is unsaved
	$(window).on('beforeunload', alert_if_unsaved);
	
	$('html,body').css('height', '100%');

	$('#filter-text').on('typeahead:selected typeahead:autocompleted',
			NRDB.card_modal.typeahead);

	$(document).on('hidden.bs.modal', function (event) {
		if(InputByTitle) {
			setTimeout(function () {
				$('#filter-text').typeahead('val', '').focus();
			}, 100);
		}
	});

	$('#pack_code,#prebuilt_code,.search-buttons').on('change', 'label', handle_input_change);
	
	$('.search-buttons').on('click', 'label', function(event) {
		var dropdown = $(this).closest('ul').hasClass('dropdown-menu');
		if (dropdown) {
			if (event.shiftKey) {
				if (!event.altKey) {
					uncheck_all_others.call(this);
				} else {
					check_all_others.call(this);
				}
			}
			event.stopPropagation();
		} else {
			if (!event.shiftKey && Buttons_Behavior === 'exclusive' || event.shiftKey && Buttons_Behavior === 'cumulative') {
				if (!event.altKey) {
					uncheck_all_active.call(this);
				} else {
					check_all_inactive.call(this);
				}
			}
		}
	});

	$('#filter-text').on({
		input : function (event) {
			var q = $(this).val();
			if(q.match(/^\w[:<>!]/)) NRDB.smart_filter.handler(q, refresh_collection);
			else NRDB.smart_filter.handler('', refresh_collection);
		}
	});

	$('#save_form').submit(handle_submit);

	$('#btn-save-as-copy').on('click', function(event) {
		$('#deck-save-as-copy').val(1);
	});
	$('#btn-cancel-edits').on('click', function(event) {
		var edits = $.grep(Snapshots, function (snapshot) {
			return snapshot.saved === false;
		});
		if(edits.length) {
			var confirmation = confirm("This operation will revert the changes made to the deck since "+edits[edits.length-1].date_creation.calendar()+". The last "+(edits.length > 1 ? edits.length+" edits" : "edit")+" will be lost. Do you confirm?");
			if(!confirmation) return false;
		}
		$('#deck-cancel-edits').val(1);
	});
	$('#collection').on({
		change : function(event) {
			InputByTitle = false;
			handle_quantity_change.call(this, event);
		}
	}, 'input[type=radio]');
	$('#collection').on({
		click : function(event) {
			InputByTitle = false;
		}
	}, 'a.card');
	$('.modal').on({
		change : handle_quantity_change
	}, 'input[type=radio]');
	$('input[name=show-disabled]').on({
		change : function(event) {
			HideDisabled = !$(this).prop('checked');
			refresh_collection();
		}
	});
	$('input[name=only-deck]').on({
		change : function(event) {
			ShowOnlyDeck = $(this).prop('checked');
			refresh_collection();
		}
	});
	$('input[name=display-column-1]').on({
		change : function(event) {
			$('input[name=display-column-2]').prop('checked', false);
			$('input[name=display-column-3]').prop('checked', false);
			DisplayColumns = 1;
			if (localStorage)
				localStorage.setItem('display_columns', DisplayColumns);
			refresh_collection();
		}
	});
	$('input[name=display-column-2]').on({
		change : function(event) {
			$('input[name=display-column-1]').prop('checked', false);
			$('input[name=display-column-3]').prop('checked', false);
			DisplayColumns = 2;
			if (localStorage)
				localStorage.setItem('display_columns', DisplayColumns);
			refresh_collection();
		}
	});
	$('input[name=display-column-3]').on({
		change : function(event) {
			$('input[name=display-column-1]').prop('checked', false);
			$('input[name=display-column-2]').prop('checked', false);
			DisplayColumns = 3;
			if (localStorage)
				localStorage.setItem('display_columns', DisplayColumns);
			refresh_collection();
		}
	});
	$('input[name=core-set-1]').on({
		change : function(event) {
			$('input[name=core-set-2]').prop('checked', false);
			$('input[name=core-set-3]').prop('checked', false);
			CoreSets = 1;
			if (localStorage)
				localStorage.setItem('core_sets', CoreSets);
			update_core_sets();
			refresh_collection();
		}
	});
	$('input[name=core-set-2]').on({
		change : function(event) {
			$('input[name=core-set-1]').prop('checked', false);
			$('input[name=core-set-3]').prop('checked', false);
			CoreSets = 2;
			if (localStorage)
				localStorage.setItem('core_sets', CoreSets);
			update_core_sets();
			refresh_collection();
		}
	});
	$('input[name=core-set-3]').on({
		change : function(event) {
			$('input[name=core-set-1]').prop('checked', false);
			$('input[name=core-set-2]').prop('checked', false);
			CoreSets = 3;
			if (localStorage)
				localStorage.setItem('core_sets', CoreSets);
			update_core_sets();
			refresh_collection();
		}
	});
	$('input[name=show-suggestions-0]').on({
		change : function(event) {
			$('input[name=show-suggestions-3]').prop('checked', false);
			$('input[name=show-suggestions-10]').prop('checked', false);
			NRDB.suggestions.number = 0;
			if (localStorage)
				localStorage.setItem('show_suggestions', NRDB.suggestions.number);
			NRDB.suggestions.show();
		}
	});
	$('input[name=show-suggestions-3]').on({
		change : function(event) {
			$('input[name=show-suggestions-0]').prop('checked', false);
			$('input[name=show-suggestions-10]').prop('checked', false);
			NRDB.suggestions.number = 3;
			if (localStorage)
				localStorage.setItem('show_suggestions', NRDB.suggestions.number);
			NRDB.suggestions.show();
		}
	});
	$('input[name=show-suggestions-10]').on({
		change : function(event) {
			$('input[name=show-suggestions-0]').prop('checked', false);
			$('input[name=show-suggestions-3]').prop('checked', false);
			NRDB.suggestions.number = 10;
			if (localStorage)
				localStorage.setItem('show_suggestions', NRDB.suggestions.number);
			NRDB.suggestions.show();
		}
	});
	$('input[name=buttons-behavior-cumulative]').on({
		change : function(event) {
			$('input[name=buttons-behavior-exclusive]').prop('checked', false);
			$('input[name=buttons-behavior-exclusive]').prop('checked', false);
			Buttons_Behavior = 'cumulative';
			if (localStorage)
				localStorage.setItem('buttons_behavior', Buttons_Behavior);
		}
	});
	$('input[name=buttons-behavior-exclusive]').on({
		change : function(event) {
			$('input[name=buttons-behavior-cumulative]').prop('checked', false);
			$('input[name=buttons-behavior-cumulative]').prop('checked', false);
			Buttons_Behavior = 'exclusive';
			if (localStorage)
				localStorage.setItem('buttons_behavior', Buttons_Behavior);
		}
	});
	$('thead').on({
		click : handle_header_click
	}, 'a[data-sort]');
	$('#cardModal').on({
		keypress : function(event) {
			var num = parseInt(event.which, 10) - 48;
			$('.modal input[type=radio][value=' + num + ']').trigger('change');
		}
	});

	var converter = new Markdown.Converter();
	$('#description').on('keyup', function() {
		$('#description-preview').html(
				converter.makeHtml($('#description').val()));
	});

	$('#description').textcomplete([{
		match : /\B#([\-+\w]*)$/,
		search : function(term, callback) {
			var regexp = new RegExp('\\b' + term, 'i');
			callback(NRDB.data.cards.find({
				title : regexp
			}));
		},
		template : function(value) {
			return value.title;
		},
		replace : function(value) {
			return '[' + value.title + ']('
					+ Routing.generate('cards_zoom', {card_code:value.code})
					+ ')';
		},
		index : 1
	}, {
		match : /\$([\-+\w]*)$/,
		search : function(term, callback) {
			var regexp = new RegExp('^' + term);
			callback($.grep(['credit', 'recurring-credit', 'click', 'link', 'trash', 'subroutine', 'mu', '1mu', '2mu', '3mu',
				'anarch', 'criminal', 'shaper', 'haas-bioroid', 'weyland-consortium', 'jinteki', 'nbn'],
				function(symbol) { return regexp.test(symbol); }
			));
		},
		template : function(value) {
			return value;
		},
		replace : function(value) {
			return '<span class="icon icon-' + value + '"></span>';
		},
		index : 1
	}]);
	$('#mwl_code').on('change', update_mwl);
	$('#tbody-history').on('click', 'a[role=button]', load_snapshot);
	setInterval(autosave_interval, 1000);
});
function autosave_interval() {
	if(Autosave_running) return;
	if(Autosave_timer < 0 && Deck_id) Autosave_timer = Autosave_period;
	if(Autosave_timer === 0) {
		deck_autosave();
	}
	Autosave_timer--;
}
// if diff is undefined, consider it is the content at load
function add_snapshot(snapshot) {
	snapshot.date_creation = snapshot.date_creation ? moment(snapshot.date_creation) : moment();
	Snapshots.push(snapshot);

	var list = [];
	if(snapshot.variation) {
		$.each(snapshot.variation[0], function (code, qty) {
			var card = NRDB.data.cards.findById(code);
			if(!card) return;
			list.push('+'+qty+' '+'<a href="'+Routing.generate('cards_zoom',{card_code:code})+'" class="card" data-index="'+code+'">'+card.title+'</a>');
		});
		$.each(snapshot.variation[1], function (code, qty) {
			var card = NRDB.data.cards.findById(code);
			if(!card) return;
			list.push('&minus;'+qty+' '+'<a href="'+Routing.generate('cards_zoom',{card_code:code})+'" class="card" data-index="'+code+'">'+card.title+'</a>');
		});
	} else {
		list.push("First version");
	}

	$('#tbody-history').prepend('<tr'+(snapshot.saved ? '' : ' class="warning"')+'><td>'+snapshot.date_creation.calendar()+(snapshot.saved ? '' : ' (unsaved)')+'</td><td>'+list.join('<br>')+'</td><td><a role="button" href="#" data-index="'+(Snapshots.length-1)+'"">Revert</a></td></tr>');

	Autosave_timer = -1; // start timer
}
function load_snapshot(event) {
	var index = $(this).data('index');
	var snapshot = Snapshots[index];
	if(!snapshot) return;

	NRDB.data.cards.find().forEach(function(card) {
		var indeck = 0;
		if (snapshot.content[card.code]) {
			indeck = parseInt(snapshot.content[card.code], 10);
		}
		NRDB.data.cards.updateById(card.code, {
			indeck : indeck
		});
	});
	update_deck();
	refresh_collection();
	NRDB.suggestions.compute();
	Deck_changed_since_last_autosave = true;
	return false;
}
function deck_autosave() {
	// check if deck has been modified since last autosave
	if(!Deck_changed_since_last_autosave || !Deck_id) return;
	// compute diff between last snapshot and current deck
	var last_snapshot = Snapshots[Snapshots.length-1].content;
	var current_deck = get_deck_content();
	Deck_changed_since_last_autosave = false;
	var r = NRDB.diff.compute_simple([current_deck, last_snapshot]);
	if(!r) return;
	var diff = JSON.stringify(r[0]);
	if(diff == '[{},{}]') return;
	// send diff to autosave
	$('#tab-header-history').html("Autosave...");
	Autosave_running = true;
	$.ajax(Routing.generate('deck_autosave', {deck_id:Deck_id}), {
		data: {diff:diff},
		type: 'POST',
		success: function(data, textStatus, jqXHR) {
			add_snapshot({date_creation: data, variation: r[0], content: current_deck, saved: false});
		},
		error: function(jqXHR, textStatus, errorThrown) {
			console.log('['+moment().format('YYYY-MM-DD HH:mm:ss')+'] Error on '+this.url, textStatus, errorThrown);
			Deck_changed_since_last_autosave = true;
		},
		complete: function () {
			$('#tab-header-history').html("History");
			Autosave_running = false;
		}
	});
}
function handle_header_click(event) {
	event.preventDefault();
	var new_sort = $(this).data('sort');
	if (Sort == new_sort) {
		Order *= -1;
	} else {
		Sort = new_sort;
		Order = 1;
	}
	$(this).closest('tr').find('th').removeClass('dropup').find('span.caret')
			.remove();
	$(this).after('<span class="caret"></span>').closest('th').addClass(
			Order > 0 ? '' : 'dropup');
	refresh_collection();
}
function handle_input_change(event) {
	var div = $(this).closest('.filter');
	var columnName = div.attr('id');
	var arr = [];
	div.find("input[type=checkbox]").each(function(index, elt) {
		if ($(elt).prop('checked'))
			arr.push($(elt).attr('name'));
		if (columnName == "pack_code" && localStorage)
			localStorage.setItem('pack_code_' + $(elt).attr('name'), $(
					elt).prop('checked') ? "on" : "off");
		if (columnName == "prebuilt_code" && localStorage)
			localStorage.setItem('prebuilt_code_' + $(elt).attr('name'), $(
					elt).prop('checked') ? "on" : "off");
	});
	Filters[columnName] = arr;
	FilterQuery = get_filter_query(Filters);
	refresh_collection();
}
function get_deck_content() {
	return _.reduce(
			NRDB.data.cards.find({indeck:{'$gt':0}}),
			function (acc, card) { acc[card.code] = card.indeck; return acc; },
			{});
}
function handle_submit(event) {
	Deck_changed_since_last_autosave = false;
	var deck_json = JSON.stringify(get_deck_content());
	$('input[name=content]').val(deck_json);
	$('input[name=description]').val($('textarea[name=description_]').val());
	$('input[name=tags]').val($('input[name=tags_]').val());
}

function handle_quantity_change(event) {
	var index = $(this).closest('.card-container').data('index')
			|| $(this).closest('div.modal').data('index');
	var in_collection = $(this).closest('#collection').length;
	var quantity = parseInt($(this).val(), 10);
	$(this).closest('.card-container')[quantity ? "addClass" : "removeClass"]('in-deck');
	NRDB.data.cards.updateById(index, {
		indeck : quantity
	});
	var card = NRDB.data.cards.findById(index);
	if (card.type_code == "identity") {
		if (Identity.faction_code != card.faction_code) {
			// change of faction, reset agendas
			NRDB.data.cards.update({
				indeck : {
					'$gt' : 0
				},
				type_code : 'agenda'
			}, {
				indeck : 0
			});
			// also automatically change tag of deck
			$('input[name=tags_]').val(
					$('input[name=tags_]').val().split(' ').map(function (tag) {
						return tag === Identity.faction_code ? card.faction_code : tag;
					}).join(' ')
			);
		}
		NRDB.data.cards.update({
			indeck : {
				'$gt' : 0
			},
			type_code : 'identity',
			code : {
				'$ne' : index
			}
		}, {
			indeck : 0
		});
	}
	update_deck();
	if (card.type_code == "identity") {
		NRDB.draw_simulator.reset();
		$.each(CardDivs, function(nbcols, rows) {
			if (rows)
				$.each(rows, function(index, row) {
					row.removeClass("disabled").find('label').removeClass(
							"disabled").find('input[type=radio]').attr(
							"disabled", false);
				});
		});
		refresh_collection();
	} else {
		$.each(CardDivs, function(nbcols, rows) {
			// rows is an array of card rows
			if (rows && rows[index]) {
				// rows[index] is the card row of our card
				rows[index].find('input[name="qty-' + index + '"]').each(
					function(i, element) {
						if ($(element).val() != quantity) {
							$(element).prop('checked', false).closest(
							'label').removeClass('active');
						} else {
							if(!in_collection) {
								$(element).prop('checked', true).closest(
								'label').addClass('active');
							}
						}
					}
				);
			}
		});
	}
	$('div.modal').modal('hide');
	NRDB.suggestions.compute();

	Deck_changed_since_last_autosave = true;
}

function update_core_sets() {
	CardDivs = [ null, {}, {}, {} ];
	NRDB.data.cards.find({
		pack_code : 'core'
	}).forEach(function(card) {
		var max_qty = Math.min(card.quantity * CoreSets, card.deck_limit);
		if(Identity.pack_code == "draft") {
			max_qty = 9;
		}
		NRDB.data.cards.updateById(card.code, {
			maxqty : max_qty
		});
	});
}

function update_mwl(event) {
	var mwl_code = $(this).val();
	MWL = null;
	if(mwl_code) {
		var mwl = NRDB.data.mwl.findById(mwl_code);
		if(mwl.cards) {
			MWL = mwl.cards;
		}
	}
	CardDivs = [ null, {}, {}, {} ];
	refresh_collection();
	update_deck();
}

function build_div(record) {
	var influ = "";
	for (var i = 0; i < record.faction_cost; i++)
		influ += "●";

	var radios = '';
	for (var i = 0; i <= record.maxqty; i++) {
		if(i && !(i%4)) {
			radios += '<br>';
		}
		radios += '<label class="btn btn-xs btn-default'
				+ (i == record.indeck ? ' active' : '')
				+ '"><input type="radio" name="qty-' + record.code
				+ '" value="' + i + '">' + i + '</label>';
	}

	var div = '';
	switch (DisplayColumns) {
	case 1:

		var imgsrc = record.faction_code.substr(0,7) === "neutral" ? "" : '<img src="'
				+ Url_FactionImage.replace('xxx', record.faction_code)
				+ '.png" alt="'+record.faction.name+'">';
		div = $('<tr class="card-container" data-index="'
				+ record.code
				+ '"><td><div class="btn-group" data-toggle="buttons">'
				+ radios
				+ '</div></td><td><a class="card" href="'
				+ Routing.generate('cards_zoom', {card_code:record.code})
				+ '" data-target="#cardModal" data-remote="false" data-toggle="modal">'
				+ record.title + '</a> '+get_influence_penalty_icons(record)+'</td><td class="influence influence-' + record.faction_code
				+ '">' + influ + '</td><td class="type" title="' + record.type.name
				+ '"><img src="/bundles/app/images/types/'
				+ record.type_code + '.png" alt="'+record.type.name+'">'
				+ '</td><td class="faction" title="' + record.faction.name + '">'
				+ imgsrc + '</td></tr>');
		break;

	case 2:

		div = $('<div class="col-sm-6 card-container" data-index="'
				+ record.code
				+ '">'
				+ '<div class="media"><div class="media-left">'
				+ '<img class="media-object" src="/card_image/'
				+ record.code
				+ '.png" alt="'+record.title+'">'
				+ '</div><div class="media-body">'
				+ '    <h4 class="media-heading"><a class="card" href="'
				+ Routing.generate('cards_zoom', {card_code:record.code})
				+ '" data-target="#cardModal" data-remote="false" data-toggle="modal">'
				+ record.title + '</a> '+get_influence_penalty_icons(record)+'</h4>'
				+ '    <div class="btn-group" data-toggle="buttons">' + radios
				+ '</div>' + '    <span class="influence influence-' + record.faction_code + '">'
				+ influ + '</span>' + '</div>' + '</div>' + '</div>');
		break;

	case 3:

		div = $('<div class="col-sm-4 card-container" data-index="'
				+ record.code
				+ '">'
				+ '<div class="media"><div class="media-left">'
				+ '<img class="media-object" src="/card_image/'
				+ record.code
				+ '.png" alt="'+record.title+'">'
				+ '</div><div class="media-body">'
				+ '    <h5 class="media-heading"><a class="card" href="'
				+ Routing.generate('cards_zoom', {card_code:record.code})
				+ '" data-target="#cardModal" data-remote="false" data-toggle="modal">'
				+ record.title + '</a> '+get_influence_penalty_icons(record)+'</h5>'
				+ '    <div class="btn-group" data-toggle="buttons">' + radios
				+ '</div>' + '    <span class="influence influence-' + record.faction_code + '">'
				+ influ + '</span>' + '</div>' + '</div>' + '</div>');
		break;

	}

	return div;
}

function is_card_usable(record) {
	if (Identity.code == "03002"
			&& record.faction_code == "jinteki")
		return false;
	if (record.type_code === "agenda"
			&& record.faction_code !== "neutral-corp"
			&& record.faction_code !== Identity.faction_code
			&& Identity.faction_code !== "neutral-corp")
		return false;
	return true;
}

function update_filtered() {
	$('#collection-table').empty();
	$('#collection-grid').empty();

	var counter = 0, container = $('#collection-table');
	var SmartFilterQuery = NRDB.smart_filter.get_query(FilterQuery);
	
	var orderBy = {};
	orderBy[Sort] = Order;
	if(Sort != 'title') orderBy['title'] = 1;
	
	NRDB.data.cards.find(SmartFilterQuery, {'$orderBy':orderBy}).forEach(function(card) {
		if (ShowOnlyDeck && !card.indeck)
			return;

		var unusable = !is_card_usable(card);

		if (HideDisabled && unusable)
			return;

		var index = card.code;
		var row = (CardDivs[DisplayColumns][index] || (CardDivs[DisplayColumns][index] = build_div(card)))
				.data("index", card.code);
		row.find('input[name="qty-' + card.code + '"]').each(
				function(i, element) {
					if ($(element).val() == card.indeck)
						$(element).prop('checked', true)
								.closest('label').addClass(
										'active');
					else
						$(element).prop('checked', false)
								.closest('label').removeClass(
										'active');
				});

		if (unusable)
			row.find('label').addClass("disabled").find(
					'input[type=radio]').attr("disabled", true);

		if (DisplayColumns > 1
				&& counter % DisplayColumns === 0) {
			container = $('<div class="row"></div>').appendTo(
					$('#collection-grid'));
		}
		container.append(row);
		counter++;
	});
}
var refresh_collection = debounce(update_filtered, 250);

function alert_if_unsaved(event) {
	if(Deck_changed_since_last_autosave && !window.confirm("Deck is not saved. Do you really want to leave?")) {
		event.preventDefault();
		return false;
	}
}