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
//       [id] :  [ {"x":"..", "y":"..", "state":".."}, {..} , .. ] },
//			 [id..]: [...]

function processData(data, facility, system, settings) {

	if (!Array.isArray(data) || settings === undefined) return; // Check for Existence

	// each Function Call new Variables
	const processedData = {};
	let maxDate = data[0].date || 0;

	// Join Data to the Object, which is used by the website
	for (let i = 0; i < data.length; i++) {
		let k = 0;
		maxDate = Math.max(maxDate, data[i].date);

		for (let j = 0; j < data[i].values.length; j++) {
			// head-data of measuring-points
			if ((!settings.ignore || settings.ignore.indexOf(j) === -1) && k < settings.items.length) {
				// if it didn't exist before in process for return
				let id = settings.items[k].id || settings.unnamedItem.id + k;
        let mount = settings.items[k].mount || facility + '/' + system + '/' + id;
				if (!processedData[mount]) {
					processedData[mount] = [];
				}

				processedData[mount].push({
					x: data[i].date,
					y: data[i].values[j]
				})
				k++;
			}
		}
	}

	return {
		values: processedData,
		facility: facility,
		system: system,
		date: maxDate
	};
}
