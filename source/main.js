import Transformer from "./class/Transformer";
import PathParser from "./class/PathParser";
import BigDecimal from "./class/BigDecimal";
import * as fs from 'fs';

/*
export function transform(text, configuration, require)
{
	console.log("Transforming"); 
	window.PathParser = PathParser;
	window.BigDecimal = BigDecimal;
	var tt = `
	<svg>
		<unit id="pp" value="3n" />
		<unit id="n" value="2" />
		<unit id="q" value="3n + 4pp((3))" />
		<segment id="kSegment" d="l 20 0 " />
		<segment id="kSegment2" d="L 200,100" />
		<segment id="kSegment3" d="c 20,50 80,-50 100,0" />
		<segment id="kSegment4" d="a 50,60 30 1 0 100,0" />
		<segment id="kSegment5" d="l 100,20 l 100,-20 l @400,@400" />
		<segment id="purple" d="h 5j v 5j h 3n" />
		<apath d="m 50,50n kSegment kSegment % 90 l -3.2.5 l-20-20 40 40 l 50 0 l 50 50" />
		<apath d="M 100,100 kSegment2 L 100,100 kSegment2%45 L 300,100" />
		<apath d="M 100,100 kSegment2%90 M 200,200 kSegment2%90" />
		<apath d="M 100,100 kSegment3" />
		<apath d="M 100,300 kSegment3%90" />
		<apath d="M 100,100 kSegment4" />
		<apath d="M 100,300 kSegment4%90" />
		<apath d="M 100,100 kSegment5" />
		<apath d="M 100,100 kSegment5%30" />
		<apath d="M 100,100 m 30,30 3kSegment2()%45 3kSegment z" />
		<apath d="M 100,100 purple(j=5 n=5 #=2)m(49) 50" />
		<segment id="green" d="h 50 v 50" />
		<apath d="M 100,100 green%|green|" />
		<path d="m 50,50 h 30 h 30 h 30" />
		<include href="somefile.svg#element" />
	</svg>`;
	tt = `<svg viewBox="0 0 300 300">
		<path d="m 50,50 Q 50,100 100,100 Q 150,100 150,50 Q 150,0 100,0" stroke="red" strokewidth="3" />
		<path d="m 50,75 Q 50,125 100,125 T 150,75 T 100,25" fill="transparent" stroke="red" strokewidth="3" />
	</svg>`;
	return((new Transformer(tt)).transform());
};
*/

(function() {
	let parameter = process.argv.slice(2);
	let valid = true;
	let reading = true;
	let whitespaceTypeList = ["path", "xml", "all"];
	let configuration =
	{
		stripWhitespace: null,
		stripComments: false,
		combinePathCommands: false,
		precision: 3
	};

	while(reading && valid && parameter[0] && parameter[0].startsWith("--"))
		switch(parameter[0])
		{
			case "--precision":
				configuration.precision = parseInt(parameter[1]);
				if(configuration.precision.toString() !== parameter[1] || isNaN(configuration.precision))
				{
					console.log("Invalid syntax for --precision switch");
					valid = false;
				}
				else
					parameter = parameter.slice(2);
				break;
			case "--stripWhitespace":
				configuration.stripWhitespace = parameter[1];
				if(whitespaceTypeList.indexOf(configuration.stripWhitespace) === -1)
				{
					console.log("Invalid syntax for --stripWhitespace switch");
					valid = false;
				}
				else
					parameter = parameter.slice(2);
				break;
			case "--stripComments":
				configuration.stripComments = true;
				parameter.shift();
				break;
			case "--combinePathCommands":
				configuration.combinePathCommands = true;
				parameter.shift();
				break;
			case "--extract":
				configuration.extract = true;
				parameter.shift();
				break;
			case "--":
				parameter.shift();
			default:
				reading = false;
			break;
		}
	if(!valid || parameter.length < 2)
	{
		console.log(
`
Usage: npm start -- [options] <source> <destination> [units...]

source       An unprocessed SVG file containing Pather commands
destination  Desired filename of the processed output
options      One or more of the following switches:
  --precision <n>                   Write numbers to the output with N decimal places. Default is 3
  --stripWhitespace <path|xml|all>  Strip whitespace from within path data, between XML tags or both (all)
  --stripComments                   Strip XML comments from the output document
  --combinePathCommands             Combine repeated commands in path data, e.g. h 30 h 30 becomes h 60
  --extract                         Extract all elements with an ID to individual files (destination is a directory)
units        Variable values to be passed to the Pather environment
             Name/value pairs separated by "=", e.g. myUnit=3 myOtherUnit=4.2
`
			);
	}
	else
	{
		let source = parameter.shift();
		configuration.destination = parameter.shift();
		configuration.unit = {};
		reading = true;
		while(reading && parameter.length) {
			let unit = parameter.shift().split("=");
			let reason;
			switch(true)
			{
				case unit.length !== 2:
					reason = `Invalid unit format "${unit.join("=")}".`;
					break;
				case new RegExp("^[bdefgijknopruwxy]|[a-z_$][a-z0-9_$]+$", "i").exec(unit[0]) === null:
					reason = `Invalid unit name "${unit[0]}".`;
					break;
				case parseFloat(unit[1]).toString() !== unit[1].substr(0, parseFloat(unit[1]).toString().length) || isNaN(parseFloat(unit[1])) || parseFloat(unit[1]) === Infinity || parseFloat(unit[1]) === -Infinity:
					reason = `Invalid unit value "${unit[1]}".`;
					break;
			}
			if(reason)
			{
				console.log(`${reason} Expected valid identifier followed by a number, e.g. myUnit=3`); 
				reading = false;
			}
			else
				configuration.unit[unit[0]] = parseFloat(unit[1]);
		}
		if(reading)
		{
			// console.log(configuration);
			const fs = require('fs');
			const path = require('path');
			configuration.base = path.dirname(source) + path.sep;
			const data = fs.readFileSync(source, {encoding: "utf-8", flag: "r"});
			let t = new Transformer(data);
			let output = t.transform(configuration);
			output.forEach(([i, j]) =>
			{
				if(!fs.existsSync(path.dirname(i)))
					fs.mkdirSync(path.dirname(i));
				fs.writeFileSync(i, j, {encoding: "utf-8"})

				return;
			});
		}
	}

	return;
})();
