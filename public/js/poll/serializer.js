"use strict";
/* globals require, utils */

(function(module) {

	var utils;
	var Serializer = {};

	if ('undefined' === typeof window) {
		utils 	= require.main.require('./src/utils');
	} else {
		utils = window.utils;
	}

	var pollRegex = /(?:(?:\[poll(?<settings>.*?)\])(?:\\n|\n|<br \/>)(?<content>(?:-.+?(?:\\n|\n|<br \/>))+)(?:\[\/poll\]))/g;
	var settingsRegex = /(?<key>.+?)=(?:"|&quot;)(?<value>.+?)(?:"|&quot;)/g;
	var settingsValidators = {
		title: {
			test: function (value) {
				return value.length > 0;
			},
			parse: function(value) {
				return utils.stripHTMLTags(value).trim();
			}
		},
		maxvotes: {
			test: function (value) {
				return !isNaN(value);
			},
			parse: function(value) {
				return parseInt(value, 10);
			}
		},
		disallowVoteUpdate: {
			test: function (value) {
				return /true|false/.test(value);
			},
			parse: function(value) {
				return value === "true" || value === true ? 1 : 0;
			}
		},
		end: {
			test: function (value) {
				return (!isNaN(value) && parseInt(value, 10) > Date.now());
			},
			parse: function(value) {
				return parseInt(value, 10);
			}
		}
	};

	Serializer.canSerialize = function(post) {
		return pollRegex.test(post) !== null;
	};

	Serializer.removeMarkup = function(content, replace) {
		return content.replace(pollRegex, replace || '');
	};

	Serializer.hasMarkup = function(content) {
		const has = pollRegex.test(content) !== null;
		return has;
	};

	Serializer.serialize = function(post, config) {
		pollRegex.lastIndex = 0;
		var match = pollRegex.exec(post);

		if (match === null) {
			return null;
		}

		return {
			options: serializeOptions(match.groups.content, config),
			settings: serializeSettings(match.groups.settings, config)
		};
	};

	Serializer.deserialize = function(poll, config) {
		var options = deserializeOptions(poll.options, config);
		var settings = deserializeSettings(poll.settings, config);

		return '[poll' + settings +']\n' + options + '\n[/poll]';
	};

	function serializeOptions(raw, config) {
		// Depending on composer, the line breaks can either be \n or <br /> so handle both
		var pollOptions = [];
		var rawOptions = raw.split(/(?:\\n|\n|<br \/>)/);
		rawOptions.map(raw => utils.stripHTMLTags(raw));
		var maxOptions = parseInt(config.limits.maxOptions, 10);

		rawOptions.forEach(function(option) {
			if (option.length) {
				option = option.split('-')[1].trim();

				if (option.length) {
					pollOptions.push(option);
				}
			}
		});

		if (pollOptions.length > maxOptions) {
			pollOptions = pollOptions.slice(0, maxOptions - 1);
		}

		return pollOptions;
	}

	function deserializeOptions(options, config) {
		var maxOptions = config.limits.maxOptions;

		options = options.map(function (option) {
			return utils.stripHTMLTags(option).trim();
		}).filter(function (option) {
			return option.length;
		});

		if (options.length > maxOptions) {
			options = options.slice(0, maxOptions - 1);
		}

		return options.length ? '- ' + options.join('\n- ') : '';
	}

	function serializeSettings(raw, config) {
		var settings = {};

		Object.keys(config.defaults).forEach(function(key) {
			settings[key] = config.defaults[key];
		});

		const stripped = utils.stripHTMLTags(raw);
		let match;
		while ((match = settingsRegex.exec(stripped)) !== null) {
			var key = match.key.trim();
			var value = match.value.trim();

			if (key.length && value.length && settingsValidators.hasOwnProperty(key)) {
				if (settingsValidators[key].test(value)) {
					settings[key] = settingsValidators[key].parse(value);
				}
			}
		}

		return settings;
	}

	function deserializeSettings(settings, config) {
		var deserialized = '';

		for (var k in settings) {
			if (settings.hasOwnProperty(k) && config.defaults.hasOwnProperty(k)) {
				var key = utils.stripHTMLTags(k).trim();
				var value = utils.stripHTMLTags(settings[k]).trim();

				if (key.length && value.length && settingsValidators.hasOwnProperty(key)) {
					if (settingsValidators[key].test(value)) {
						deserialized += ' ' + key + '="' + value + '"';
					}
				}
			}
		}

		return deserialized;
	}

	module.exports = Serializer;

	if ('undefined' !== typeof window) {
		Poll.serializer = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);