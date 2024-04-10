import ExpressionParser from "./ExpressionParser";
import Token from "./Token";
import TokenStream from "./TokenStream";
import BigDecimal from "./BigDecimal";
import Value from "./Value";
import Distortion from "./Distortion";

export default class PathParser
{
	constructor(stream)
	{
		this.stream = stream;

		return;
	}

	static resultToString(result, precision = BigDecimal.LIMIT_PRECISION)
	{
		return(result.sequence.map(i => "" + i[0].toString() + (i.length > 1 ? " " + i.slice(1).join(",") : "")).join(" "));
	}

	static parseValueAttribute(context, text)
	{
		let parser = new PathParser(new TokenStream(text));
		let pathResult = parser.parseList(context);

		return(PathParser.resultToString(pathResult, context.optimisation.path.precision));
	}

	parseList(context, result = Value.getEmptyResult(), limit = -1)
	{
		let state;
		let top;

		state =
		{
			current: this.stream.getCurrent(),
			reading: true,
			index: 0
		};
		top = [];

		while(state.reading && state.current && (state.index < limit || limit === -1))
		{
			switch(state.current.type)
			{
				case Token.TYPE_WHITESPACE:
				case Token.TYPE_DELIMITER:
					break;
				case Token.TYPE_END:
					state.reading = false;
					break;
				default:
					let expResult = new ExpressionParser(this.stream).parse(context, 0, [], false, {x: result.x, y: result.y}, Value.TYPE_UNIT);
					result.sequence.push([expResult.accumulator]);
					result.index++;
					state.current = this.stream.getCurrent();
					continue;
			}
			state.current = this.stream.getNext();
		}

		return(result);
	}

	parse(context, result = Value.getEmptyResult(), distortionStack = [], index = 1, argumentList)
	{
		let state;
		let top;
		let invoked;
		let next;

		state =
		{
			current: this.stream.getCurrent(),
			reading: true
		};
		distortionStack.forEach(item =>
		{
			if(item.type === Distortion.OPERATION_REVERSE_ORDER)
				item.value = new BigDecimal(result.sequence.length);

			return;
		});

		while(state.reading && state.current)
		{
			switch(state.current.type)
			{
				case Token.TYPE_COMMAND:
					if(result.arity === null && state.current.name.toLowerCase() !== "m")
						throw(new SyntaxError("Paths must begin with a Move To command"));
					if(top)
						Distortion.applyDistortion(context, top, result, distortionStack);
					result.arity = state.current.value;
					result.pending = result.arity.length;
					top = [state.current.name];
					break;
				case Token.TYPE_OPERATOR_FIX:
					result.fixNext = true;
					break;
				case Token.TYPE_WHITESPACE:
				case Token.TYPE_DELIMITER:
					break;
				case Token.TYPE_END:
					if(top)
						Distortion.applyDistortion(context, top, result, distortionStack);
					state.reading = false;
					break;
				case Token.TYPE_IDENTIFIER:
				case Token.TYPE_NUMBER:
					if(state.current.type === Token.TYPE_NUMBER)
					{
						next = this.stream.peekNext();
						invoked = next.type === Token.TYPE_IDENTIFIER && context.segment[next.name];
					}
					else
						invoked = context.segment[state.current.name];
					if(invoked)
					{
						if(top)
						{
							Distortion.applyDistortion(context, top, result, distortionStack);
							top = null;
						}
						new ExpressionParser(this.stream).parseInvocation(context, result, argumentList, distortionStack.concat());
						state.current = this.stream.getCurrent();
						continue;
					}
				default:
					if(!top)
						throw(new Error(`Expected command, but found "${state.current.name}"`));
					if(!result.pending)
					{
						Distortion.applyDistortion(context, top, result, distortionStack);
						result.pending = result.arity.length;
						top = [top[0]];
					}
					if(!result.pending)
						throw(new SyntaxError(`Too many parameters supplied to command "${top[0]}"`));
					if(top[0].toLowerCase() === "a" && (result.pending === 4 || result.pending === 3) && state.current.type === Token.TYPE_NUMBER && state.current.name.length > 1 && ["0", "1"].indexOf(state.current.name.substr(0, 1)) !== -1)
					{
						top.push({fixed: result.fixNext, value: new BigDecimal(state.current.name.substr(0, 1))});
						state.current.name = state.current.name.substr(1);
						state.current.value = new BigDecimal(state.current.name);
					}
					else
					{
						if(state.current.type === Token.TYPE_NUMBER)
						{
							next = this.stream.peekNext();
							invoked = next.type === Token.TYPE_IDENTIFIER ? context.segment[next.name] : null;
						}
						else
							invoked = context.segment[state.current.name];
						if(invoked == null)
						{
							let expResult = new ExpressionParser(this.stream).parse(context, 0, argumentList, false, {x: result.x, y: result.y}, result.arity[result.arity.length - result.pending]);
							top.push({fixed: result.fixNext, value: expResult.accumulator});
						}
					}
					result.fixNext = false;
					result.pending--;
					state.current = this.stream.getCurrent();
					continue;
			}
			state.current = this.stream.getNext();
		}

		return(result);
	}
}
