'use strict';

// Module exports
module.exports = processData;

// Process incoming Data

//  Parameters:
//    settings: configuration (dataConfig)
//    currentData: data (copywatch & state)
//      currentData.data <-- Array of Strings
//      currentData.state <-- Object of Boolean-Arrays
//  Return:
//    JSON-Object-Structure:
//      values: Object of:
//       [indent] :  [ {"x":"..", "y":"..", "state":".."}, {..} , .. ] },
//			 [indent..]: [...]

function processData(data, facility, settings) {

	if (!Array.isArray(data) || settings === undefined) return; // Check for Existence

	// each Function Call new Variables
	var processedData = {},
		buffer = {},
		floatArrayView = {},
		state, indent,
		maxDate = data[0].date || 0;

	var bufferLength = data.length * 8;

	// Join Data to the Object, which is used by the website
	var element;
	for (var i = 0; i < data.length; i++) {
		var k = 0;
		data[i].date = +(new Date(data[i].date));
		maxDate = +(new Date(Math.max(maxDate, data[i].date)));

		for (var j = 0; j < data[i].values.length; j++) {
			// head-data of measuring-points
			if (settings.ignore.indexOf(j) === -1 && k < settings.units.length) {
				// if it dindentn't exist before in process for return
				indent = settings.units[k].indent || settings.unfacilitydType.indent + k;
				if (!processedData[indent]) {
					processedData[indent] = [];
				}
				// if (!buffer[indent]) {
				// 	buffer[indent] = {
				// 		x: new ArrayBuffer(bufferLength),
				// 		y: new ArrayBuffer(bufferLength)
				// 	};
				// 	floatArrayView[indent] = {
				// 		x: new Float64Array(buffer[indent].x),
				// 		y: new Float64Array(buffer[indent].y)
				// 	}
				// }
				// floatArrayView[indent].x[i] = data[i].date;
				// floatArrayView[indent].y[i] = data[i].values[j];
				state = 0;
				if (data[i].values[j] !== null) {
					// exceeding
					if (settings.units[k].threshold !== undefined) {
						if (settings.units[k].threshold.from !== undefined &&
							data[i].values[j] < settings.units[k].threshold.from)
							state = -1;
						else if (settings.units[k].threshold.to !== undefined &&
							data[i].values[j] > settings.units[k].threshold.to)
							state = 1;
					}
				}
				// .data is the array, in which the measuring time, the value itself and an state-value is stored
				processedData[indent].push({
					x: +(new Date(data[i].date)),
					y: data[i].values[j],
					state: state
				})
				k++;
			}
		}
	}

	return {
		values: processedData,
		// buffer: buffer,
		facility: facility,
		system: settings.system,
		date: maxDate
	};
}
