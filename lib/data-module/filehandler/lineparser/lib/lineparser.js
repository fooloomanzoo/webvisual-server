"use strict";

// REGEXPS
const regular_expressions = {
	YYYY: '([1234][0-9]{3})', // 1000 - 4999 are valid
	MM: '([1-9]|0[1-9]|1[0-2])', // 01 - 12 are valid
	DD: '([1-9]|0[1-9]|[12][0-9]|3[01])', // 01 - 31 are valid
	hh: '([0-9]|[01][0-9]|[2][0-3])', // 00 - 23 are valid
	mm: '([0-9]|[0-5][0-9])', // 00 - 59 are valid
	ss: '([0-9]|[0-5][0-9])', // 00 - 59 are valid
	lll: '([0-9]{3})', // 000 - 999 are valid,
	// short version
	Y: '([1234][0-9]{3})', // 1000 - 4999 are valid
	M: '([1-9]|0[1-9]|1[0-2])', // 01 - 12 are valid
	D: '([1-9]|0[1-9]|[12][0-9]|3[01])', // 01 - 31 are valid
	h: '([0-9]|[01][0-9]|[2][0-3])', // 00 - 23 are valid
	m: '([0-9]|[0-5][0-9])', // 00 - 59 are valid
	s: '([0-9]|[0-5][0-9])', // 00 - 59 are valid
	l: '([0-9]{3})' // 000 - 999 are valid,
};

const seperators = /[.;:\\\/\|\-,"'\!\?\s]+/;
const linefeed = /[\r\n\v]/;
const nullValue = /(\s*NaN\s*|[\s*]|\s*undefined\s*|\s*null\s*)?/;

const defaults = {
	dateFormat: 'iso',
	decimalSeparator: '.',
	valueSeparator: ';',
	dimensions: 1
};

class LineParser {

	constructor(options, passRawData = false) {
		this.setOptions(options)
		this.passRawData = passRawData;
	}

	/**
	 * set Options
	 * @param {[Object]} options [parsing options]
	 */
	setOptions(options) {
		try {
			this.options = this._initializeOptions(options);
		} catch (err) {
			console.error(`LineParser: ${err}`);
		}
	}

	/**
	 * Resets the parse options so the defaults options are used again.
	 */
	resetOptions() {
		this.options = null;
	}

	/**
	 * Initializes the options object
	 * @param  {[Object]} options [options]
	 * @return {[Object]}         [transformed options]
	 */
	_initializeOptions(options) {
		let ret;

		if (options !== null && typeof options === 'object') {
			ret = options;
		} else {
			ret = defaults;
		}

		if (ret.dateFormat && ret.dateFormat !== 'iso') {
			// Create Regular Expressions
			ret.dateFormatRegExp = ret.dateFormat;
			// '.' is a special character
			ret.dateFormatRegExp = ret.dateFormatRegExp.replace('.', '\\.');

			// replace with given Regular Expressions (above)
			for (let key in regular_expressions) {
				ret.dateFormatRegExp = ret.dateFormatRegExp.replace(key, regular_expressions[key]);
			}
			ret.dateFormatRegExp = new RegExp(ret.dateFormatRegExp, "g");

			// create Token List for faster handling
			ret.dateFormatTokens = ret.dateFormat.split(seperators);
			ret.dateFormatTokens.filter(function(key) {
				if (regular_expressions[key] === undefined)
					return false;
				else
					return true;
				}
			)
		}

		ret.valueFormatRegExp = new RegExp("(.)(([-+])?(\\d+(\\" + ret.decimalSeparator + ")?\\d*|\\d*(\\" + ret.decimalSeparator + ")?\\d+)(([eE]([-+])?)?\\d+)?)$", "g");

		// Separator is unknown? --> takes Default
		if (ret.valueSeparator === undefined || ret.valueSeparator === 'unknown' || ret.valueSeparator === '?') {
			ret.valueSeparator = defaults.valueSeparator;
		} else if (ret.valueSeparator === '??') {
			this.options.valueSeparator = '?';
		}
		// console.log(ret);
		return ret;
	}


/**
 * run parsing
 * @param  {[string]}   str    [String for parsing]
 * @param  {Function} callback [callback function]
 * @return {[Function]}        [applied callback function]
 */
	run(str, callback) {
		// Check if the str is a string
		if (typeof str !== 'string') {
			return console.log("LineParser: argument has to be from type string.");
		}
		if (!str) {
			console.log('LineParser: empty argument');
			return;
		}

		// Just to be sure
		try {
			// Define Variables
			const data = {
				date: undefined,
				values: []
			};

			let values,
				date,
				check_val,
				counter = this.options.dimensions;

      if (this.options.dateFormat === 'iso') {
        values = str.split(this.options.valueSeparator);
        date = values.shift();
        data.date = +new Date(date);
      } else {
        // Split the date from str
        check_val = str.search(this.options.dateFormatRegExp);

        if (check_val === -1) {
          throw new Error(`LineParser: String doesn't match given dateFormat ${this.options.dateFormat}\n${str}\nLength: ${str.length}`);
        }

        date = str.slice(check_val, check_val + this.options.dateFormat.length);
        str = str.slice(check_val + this.options.dateFormat.length + 1);

        // Start the parsing the date
        data.date = this._parseDate(date);

        // Extract the values from the tokens
        values = str.split(this.options.valueSeparator);
      }

      if (isNaN(data.date)) {
        throw new Error(`LineParser: invalid Date\n${data.date}`);
      }

			// Push the values into the data.values array - as numbers.
			for (let i = 0; i < values.length; i++) {
				check_val = parseFloat(values[i].replace(this.options.decimalSeparator, "."));

				if (!isNaN(check_val)) {
					if (this.options.dimensions === 1)
						data.values.push(check_val);
					else {
						if (counter === this.options.dimensions) {
							data.values.push([check_val]);
							counter = 1;
						} else {
							data.values[data.values.length - 1].push(check_val);
							counter++;
						}
					}
				} else if (i !== (values.length - 1) && linefeed.test(values[i]) === false) {
					if (nullValue.test(values[i])) {
						data.values.push(null);
					} else
						throw new Error('LineParser: String includes invalid numbers: ' + values[i] + '\n' + str);
					}
				}
			return callback(null, data, this.passRawData ? str : null);
		} catch (err) {
			return callback(err, null);
		}
	}

	/**
	 * parse dateSting
	 * @param  {[string]} dateString [datestring]
	 * @return {[number]}            [date value]
	 */
	_parseDate(dateString) {
		const date = {};
		const tokens = dateString.split(seperators);

		for (let i = 0; i < this.options.dateFormatTokens.length; i++) {
			date[this.options.dateFormatTokens[i]] = tokens[i];
		}

		return +(new Date(date.YYYY || date.Y || 0, ((date.MM || date.M || 1) - 1), date.DD || date.D || 0, date.hh || date.h || 0, date.mm || date.m || 0, date.ss || date.s || 0, date.lll || date.l || 0));
	}
}

// Module exports
module.exports = LineParser;
