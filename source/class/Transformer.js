import ExpressionParser from "./ExpressionParser";
import TokenStream from "./TokenStream";
import PathParser from "./PathParser";
import BigDecimal from "./BigDecimal";
import Value from "./Value";

export default class Transformer
{
	constructor(text)
	{
		this.document = Transformer.#parseXML(text);
	}

	static #parseXML(text)
	{
		return((new (typeof(DOMParser) === "undefined" ? require('xmldom').DOMParser : DOMParser)()).parseFromString(text, "text/xml"));
	}

	static #parseUnitList(context, list)
	{
		let stack = [];
		let item;

		while(stack.length || list.length)
		{
			if(stack.length)
				item = stack.pop();
			else
			{
				item = list.shift();
				if(!item.previousSibling.tagName && item.previousSibling.nodeValue.trim() === "")
					item.parentNode.removeChild(item.previousSibling);
				item.parentNode.removeChild(item);
			}
			let parser = new ExpressionParser(new TokenStream(item.getAttribute("value")));
			try
			{
				let result = parser.parse(context, 1, {}, false, null, Value.TYPE_UNIT);
				let id = item.getAttribute("id");
				if(id in context.unit)
					throw(new Error(`Duplicate unit ID: "${id}"`));
				context.unit[id] = result.accumulator;
			}
			catch(except)
			{
				if(except instanceof ReferenceError)
				{
					if(stack.filter(i => i.getAttribute("id") === parser.stream.getCurrent().name).length === 1)
						throw(new ReferenceError(`Circular reference to "${parser.stream.getCurrent().name}"`));
					stack.push(item);
					let next = list.filter(i => i.getAttribute("id") === parser.stream.getCurrent().name);
					if(next.length > 1)
						throw(new ReferenceError(`Unable to resolve expression "${item.getAttribute("value")}". Duplicate ID "${parser.stream.getCurrent().name}".`));
					if(next.length === 0)
						throw(new ReferenceError(`Unable to resolve expression "${item.getAttribute("value")}". "${parser.stream.getCurrent().name}" is undefined.`));
					stack.push(next[0]);
					next[0].parentNode.removeChild(next[0]);
					list = list.slice(0, list.indexOf(next[0])).concat(list.slice(list.indexOf(next[0]) + 1));
				}
				else
					throw(new Error("Couldn't parse item, " + except.message, {cause: except}));
			}
		}
	}

	static #parseSegmentList(context, list)
	{
		list.forEach(i =>
		{
			if(!i.previousSibling.tagName && i.previousSibling.nodeValue.trim() === "")
				i.parentNode.removeChild(i.previousSibling);
			i.parentNode.removeChild(i)

			return;
		});
		context.segment = list.reduce((previous, current) =>
		{
			let id = current.getAttribute("id");
			if(id in previous)
				throw(new Error(`Duplicate segment ID: "${id}"`));
			if(id in context.unit)
				throw(new Error(`Segment ID: "${id}" already defined as a unit`));
			previous[current.getAttribute("id")] = current.getAttribute("d");

			return(previous);
		}, {});
	}

	#parseIncludeList(configuration)
	{
		let list;
		let seen = [];

		do
		{
			list = Array.from(this.document.getElementsByTagName("include"));
			list.forEach(item =>
			{
				let href = item.getAttribute("href");
				if(seen.indexOf(href) !== -1)
					throw(new Error(`Circular include reference: ${href}`));
				seen.push(href);
				href = href.split("#");
				let filename = href[0];
				let id = href.length > 1 ? href.slice(1).join("#") : null;
				const fs = require('fs');
				const data = fs.readFileSync(configuration.base + filename, {encoding: "utf-8", flag: "r"});
				let inner = Transformer.#parseXML(data);
				let target;
				if(id !== null)
				{
					target = inner.getElementById(id);
					if(!target)
						throw(new Error(`Failed to include file: ${filename}, ID: ${id}`));
				}
				else
				{
					target = inner.documentElement;
					if(!target)
						throw(new Error(`Failed to include file: ${filename}`));
				}
				if(target.nodeName.toLowerCase() === "svg")
				{
					let child = target.firstChild;
					while(child)
					{
						let add = child;
						child = child.nextSibling;
						item.parentNode.insertBefore(add, item);
					}
				}
				else
				{
					let child = target;
					while(child)
					{
						let add = child;
						child = child.nextSibling;
						item.parentNode.insertBefore(add, item);
					}
				}
				item.parentNode.removeChild(item);
			});
		} while(list.length);
	}

	static #insertTemplateContent(template, replacement)
	{
		const copy = template.cloneNode(true);
		const list = Array.from(copy.getElementsByTagName("*"));
		list.forEach(element =>
			Array.from(element.attributes).forEach(attribute =>
				Object.entries(replacement).forEach(([replaceKey, replaceValue]) =>
					attribute.value = attribute.value.replaceAll(replaceKey, replaceValue)
				)
			)
		);
		if(copy.firstChild && !copy.firstChild.tagName && copy.firstChild.nodeValue.trim() === "")
				copy.removeChild(copy.firstChild);
		while(copy.firstChild)
			template.parentNode.insertBefore(copy.firstChild, template);

		return;
	}

	static #formatTemplateValue(value, format)
	{
		return(
			format.length && format === "f".repeat(format.length)
			?
				value.toString(16).padStart(format.length, "0")
			:
				format === "0".repeat(format.length)
				?
					value.toString().padStart(format.length, "0")
				:
					value.toString()
		);
	}

	static #applyTemplate(context, document)
	{
		let template = document.getElementsByTagName("template")[0];
		while(template)
		{
			switch(template.getAttribute("type"))
			{
				case "repeat":
					let start = parseInt(PathParser.parseValueAttribute(context, template.getAttribute("start"))) || 0;
					let stop = parseInt(PathParser.parseValueAttribute(context, template.getAttribute("stop"))) || 0;
					let step = parseInt(PathParser.parseValueAttribute(context, template.getAttribute("step"))) || 1;
					let columnCount = parseInt(PathParser.parseValueAttribute(context, template.getAttribute("column-count"))) || 0;
					let minimum = start < stop ? start : stop;
					let maximum = start > stop ? start : stop;
					let vMap = template.getAttribute("v-map").split(new RegExp("\\s*,\\s*", "g")).filter(item => item !== "").map(item =>
					{
						let [range, value] = item.split(new RegExp("\\s*:\\s*", "g"));
						range = range.split("-");
						if(range.length < 2)
							range[1] = range[0];
						else
							if(range.length > 2)
								range = range.slice(0, 2);
						range = range.map((i, j) => i === "*" || i === "" ? (j === 0 ? minimum : maximum) : parseInt(i) || 0)

						return({start: range[0], stop: range[1], value: value ?? ""});
					});
					let iFormat = template.getAttribute("i-format") ?? "";
					let vFormat = template.getAttribute("v-format") ?? "";
					let xFormat = template.getAttribute("x-format") ?? "";
					let yFormat = template.getAttribute("y-format") ?? "";
					let y = Math.floor(start / columnCount);
					let x = start - (y * columnCount);
					for(let index = start; index <= stop; index += step)
					{
						let v = vMap.find(item => index >= item.start && index <= item.stop)?.value ?? index;
						Transformer.#insertTemplateContent(template,
						{
							"?x?": Transformer.#formatTemplateValue(x, xFormat),
							"?y?": Transformer.#formatTemplateValue(y, yFormat),
							"?i?": Transformer.#formatTemplateValue(index, iFormat),
							"?v?": Transformer.#formatTemplateValue(v, vFormat)
						});
						x++;
						if(x === columnCount)
						{
							x = 0;
							y++;
						}
					}
					["start", "stop", "column-count"].forEach(item =>
						{
							template.setAttribute("d", );
						})
					break;
			}
			template.parentNode.removeChild(template);
			template = document.getElementsByTagName("template")[0];
		}

		return;
	}

	#extractIsolated(documentElement, base, list)
	{
		const path = require('path');

		return(list.filter(i => i.hasAttribute("id")).map(i =>
		{
			let container = documentElement.cloneNode(true);
			let cursor = container.firstChild;
			let target = null;
			let visited = [];
			while(cursor)
			{
				if(cursor.firstChild && !visited.includes(cursor.firstChild))
				{
					cursor = cursor.firstChild;
					continue;
				}
				else
				{
					let nextNode = cursor.nextSibling ?? cursor.parentNode;
					if(cursor.tagName && cursor.hasAttribute("id"))
					{
						let ancestor = cursor;
						while(ancestor && ancestor.tagName !== "defs")
							ancestor = ancestor.parentNode;
						if(!ancestor)
							if(cursor.getAttribute("id") !== i.getAttribute("id") || target !== null)
							{
								let parent = cursor.parentNode;
								if(cursor.previousSibling && !cursor.previousSibling.tagName && cursor.previousSibling.nodeValue.trim() === "")
									parent.removeChild(cursor.previousSibling);
								parent.removeChild(cursor);
							}
							else
							{
								if(target === null)
								{
									target = cursor;
									target.removeAttribute("id");
								}
								visited.push(cursor);
							}
						else
							visited.push(cursor);
					}
					else
						visited.push(cursor);
					cursor = nextNode;
				}
			}
			const chain = [];
			if(target)
			{
				while(target && !target.hasAttribute("dir"))
				{
					chain.push(target);
					target = target.parentNode;
				}
				if(target)
					if(target.attributes.length === 1 && target.parentNode)
					{
						const parent = target.parentNode;
						parent.insertBefore(chain[chain.length - 1], target);
						parent.removeChild(target);
					}
					else
						target.removeAttribute("dir");
			}
			else
				container = null;

			return([base + (target ? target.getAttribute("dir") + path.sep : "") + i.getAttribute("id") + ".svg", container]);
		})).filter(([, node]) => node !== null);
	}

	transform(configuration)
	{
		let context =
		{
			unit: {},
			depth: 1,
			optimisation:
			{
				path:
				{
					precision: configuration.precision,
					combineCommands: configuration.combinePathCommands /* Don't output h 20 h 20 */
				},
				xml:
				{
					stripWhitespace: configuration.stripWhitespace === "xml" || configuration.stripWhitespace === "all",
					stripComments: configuration.stripComments
				}
			}
		};
		this.#parseIncludeList(configuration);
		Transformer.#parseUnitList(context, Array.from(this.document.getElementsByTagName("unit")));
		for(let item in configuration.unit)
			context.unit[item] = configuration.unit[item];
		Transformer.#parseSegmentList(context, Array.from(this.document.getElementsByTagName("segment")));
		Transformer.#applyTemplate(context, this.document);
		let list = Array.from(this.document.getElementsByTagName("path"));
		context.depth = 0;
		while(list.length)
		{
			let item = list.shift();
			let parser = new PathParser(new TokenStream(item.getAttribute("d")));
			let pathResult = parser.parse(context);
			item.setAttribute("d", PathParser.resultToString(pathResult, context.optimisation.path.precision))
		}
		const scan =
		[
			{tagName: "svg", attribute: [{name: "viewBox", limit: 4}, "width", "height"]},
			{tagName: "rect", attribute: ["x", "y", "width", "height", "rx", "ry"]},
			{tagName: "circle", attribute: ["r", "cx", "cy"]},
			{tagName: "ellipse", attribute: ["rx", "ry", "cx", "cy"]},
			{tagName: "line", attribute: ["x1", "y1", "x2", "y2"]},
			{tagName: "image", attribute: ["x", "y", "width", "height"]},
			{tagName: "pattern", attribute: ["width", "height"]},
			{tagName: "polygon", attribute: [{name: "points", limit: -1}]},
			{tagName: "polyline", attribute: [{name: "points", limit: -1}]},
			{tagName: "line", attribute: ["x1", "y1", "x2", "y2"]},
			{tagName: "textPath", attribute: ["startOffset"]},
			{tagName: "path", attribute: ["stroke-width"]},
			{tagName: "image", attribute: ["x", "y", "width", "height"]},
			{tagName: "marker", attribute: ["markerWidth", "markerHeight", "refX", "refY"]},
		];
		scan.forEach(target =>
		{
			list = Array.from(this.document.getElementsByTagName(target.tagName));
			context.depth = 0;
			while(list.length)
			{
				let item = list.shift();
				target.attribute.forEach(attribute =>
				{
					let attributeName;
					let attributeLimit;

					if(typeof(attribute) === "string")
					{
						attributeName = attribute;
						attributeLimit = 1;
					}
					else
					{
						attributeName = attribute.name;
						attributeLimit = attribute.limit;
					}
					if(item.hasAttribute(attributeName))
						item.setAttribute(attributeName, PathParser.parseValueAttribute(context, item.getAttribute(attributeName)));

					return;
				})
			}

			return;
		});
		let stack = [];
		let cursor = this.document.documentElement.firstChild;
		let Node = {COMMENT_NODE: 8, TEXT_NODE: 3};
		while(stack.length || cursor)
		{
			if(cursor.firstChild)
				stack.push(cursor.firstChild);
			let target = cursor;
			if(cursor.nextSibling)
				cursor = cursor.nextSibling;
			else
				cursor = stack.pop();
			if(context.optimisation.xml.stripWhitespace && target.nodeType === Node.TEXT_NODE && target.nodeValue.replace(new RegExp("\\s+", "g"), "").length === 0)
				target.parentNode.removeChild(target);
			if(context.optimisation.xml.stripComments && target.nodeType === Node.COMMENT_NODE)
				target.parentNode.removeChild(target);
		}
		if(configuration.extract)
		{
			const path = require('path');
			let base = configuration.destination + path.sep;
			list = this.#extractIsolated(this.document.documentElement, base, Array.from(this.document.getElementsByTagName("*")));
		}
		else
			list = [[configuration.destination, this.document.documentElement]];

		return(list.map(([i, j]) => [i, (new (typeof(XMLSerializer) === "undefined" ? require("xmldom").XMLSerializer : XMLSerializer)()).serializeToString(j)]));
	}
};
