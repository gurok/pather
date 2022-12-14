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

	#parseUnitList(context, list)
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

	#parseSegmentList(context, list)
	{
		list.forEach(i => i.parentNode.removeChild(i));
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
					item.parentNode.insertBefore(target, item);
				item.parentNode.removeChild(item);
			});
		} while(list.length);
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
		this.#parseUnitList(context, Array.from(this.document.getElementsByTagName("unit")));
		for(let item in configuration.unit)
			context.unit[item] = configuration.unit[item];
		this.#parseSegmentList(context, Array.from(this.document.getElementsByTagName("segment")));
		let list = Array.from(this.document.getElementsByTagName("path"));
		context.depth = 0;
		while(list.length)
		{
			let item = list.shift();
			let parser = new PathParser(new TokenStream(item.getAttribute("d")));
			let pathResult = parser.parse(context);
			item.setAttribute("d", PathParser.resultToString(pathResult, context.optimisation.path.precision))
		}
		list = Array.from(this.document.getElementsByTagName("svg"));
		context.depth = 0;
		while(list.length)
		{
			let item = list.shift();
			if(item.hasAttribute("viewBox"))
			{
				let parser = new PathParser(new TokenStream(item.getAttribute("viewBox")));
				let viewBoxResult = parser.parseList(context, Value.getEmptyResult(), 4);
				item.setAttribute("viewBox", PathParser.resultToString(viewBoxResult, context.optimisation.path.precision));
			}
		}
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

		return((new (typeof(XMLSerializer) === "undefined" ? require("xmldom").XMLSerializer : XMLSerializer)()).serializeToString(this.document.documentElement));
	}
};
