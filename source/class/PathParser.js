import ExpressionParser from "./ExpressionParser";
import Token from "./Token";
import TokenStream from "./TokenStream";
import BigDecimal from "./BigDecimal";
import Value from "./Value";

export default class PathParser
{
	constructor(stream)
	{
		this.stream = stream;
	}

	static resultToString(result, precision = BigDecimal.LIMIT_PRECISION)
	{
		return(result.sequence.map(i => "" + i[0].toString() + (i.length > 1 ? " " + i.slice(1).join(",") : "")).join(" "));
	}

	static #rotate(x0, y0, x1, y1, angle)
	{
		var cosine;
		var sine;

		x1 = x1.subtract(x0);
		y1 = y1.subtract(y0);
		angle = (angle.toNumber() % 360) * Math.PI / 180;
		cosine = Math.cos(angle);
		sine = Math.sin(angle);
		if(Math.abs(cosine - sine) < Number.EPSILON * 2)
			sine = cosine;
		else
			if(Math.abs(cosine + sine) < Number.EPSILON * 2)
				cosine = sine;
		if(Math.abs(cosine) < Number.EPSILON)
			cosine = 0;
		if(Math.abs(sine) < Number.EPSILON)
			sine = 0;
	
		return(
		{
			x: x0.add(x1.multiplyBy(cosine)).subtract(y1.multiplyBy(sine)),
			y: y0.add(y1.multiplyBy(cosine)).add(x1.multiplyBy(sine))
		});
	};

	static #applyRotation(context, top, result, angle)
	{
		let origin;
		let point;
		let command;
		let relative;
		let point1;
		let point2;
		let last;
		let lastAngle;

		command = top[0].toLowerCase();
		relative = top[0].toLowerCase() === top[0];
		origin =
		{
			x: relative ? new BigDecimal(0) : result.x,
			y: relative ? new BigDecimal(0) : result.y
		}
		if(result.pending)
			throw(new SyntaxError(`Too few arguments for command ${top[0]}`));
		if(result.fixNext)
			throw(new SyntaxError(`Dangling fix operator after command ${top[0]}`));
		// TODO: Eventually, all values will need to be rounded just beyond this point
		switch(command)
		{
			case "a":
				point =
				{
					x: top[6].value,
					y: top[7].value
				};
				if(angle)
					point = PathParser.#rotate(origin.x, origin.y, point.x, point.y, angle);
				if(top[6].fixed)
					point.x = relative ? top[6].value.subtract(result.x) : top[6].value;
				if(top[7].fixed)
					point.y = relative ? top[7].value.subtract(result.y) : top[7].value;
				top =
				[
					top[0],
					top[1].value,
					top[2].value,
					top[3].fixed ? top[3].value : top[3].value.add(angle),
					top[4].value,
					top[5].value,
					point.x,
					point.y
				];
				break;
			case "c":
				point1 =
				{
					x: top[1].value,
					y: top[2].value
				};
				point2 =
				{
					x: top[3].value,
					y: top[4].value
				};
				point =
				{
					x: top[5].value,
					y: top[6].value
				};
				if(angle)
				{
					point1 = PathParser.#rotate(origin.x, origin.y, point1.x, point1.y, angle);
					point2 = PathParser.#rotate(origin.x, origin.y, point2.x, point2.y, angle);
					point = PathParser.#rotate(origin.x, origin.y, point.x, point.y, angle);
				}
				if(top[5].fixed)
					point.x = relative ? top[5].value.subtract(result.x) : top[5].value;
				if(top[6].fixed)
					point.y = relative ? top[6].value.subtract(result.y) : top[6].value;
				top =
				[
					top[0],
					top[1].fixed ? (relative ? top[1].value.subtract(result.x) : top[1].value) : point1.x,
					top[2].fixed ? (relative ? top[2].value.subtract(result.y) : top[2].value) : point1.y,
					top[3].fixed ? (relative ? top[3].value.subtract(result.x) : top[3].value) : point2.x,
					top[4].fixed ? (relative ? top[4].value.subtract(result.y) : top[4].value) : point2.y,
					point.x,
					point.y
				];
				break;
			case "s":
			case "q":
				point1 =
				{
					x: top[1].value,
					y: top[2].value
				};
				point =
				{
					x: top[3].value,
					y: top[4].value
				};
				if(angle)
				{
					point1 = PathParser.#rotate(origin.x, origin.y, point1.x, point1.y, angle);
					point = PathParser.#rotate(origin.x, origin.y, point.x, point.y, angle);
				}
				if(top[3].fixed)
					point.x = relative ? top[3].value.subtract(result.x) : top[3].value;
				if(top[4].fixed)
					point.y = relative ? top[4].value.subtract(result.y) : top[4].value;
				top =
				[
					top[0],
					point1.x,
					point1.y,
					point.x,
					point.y
				];
				break;
			case "l":
			case "h":
			case "v":
				point =
				{
					x: command === "v" ? new BigDecimal(origin.x) : top[1].value,
					y: command === "h" ? new BigDecimal(origin.y) : (command === "v" ? top[1].value : top[2].value)
				};
				if(angle)
					point = PathParser.#rotate(origin.x, origin.y, point.x, point.y, angle);
				lastAngle = Math.atan2(point.y.subtract(origin.y).toNumber(), point.x.subtract(origin.x).toNumber()) * 180 / Math.PI;
				if(top[1].fixed)
					if(command === "v")
						point.y = relative ? top[1].value.subtract(result.y) : top[1].value;
					else
						point.x = relative ? top[1].value.subtract(result.x) : top[1].value;
				if(command === "l" && top[2].fixed)
					point.y = relative ? top[2].value.subtract(result.y) : top[2].value;
				top = point.x.equals(origin.x)
					?
					(
						point.y.equals(origin.y)
						?
							null
						:
							["v", point.y]
					)
					:
					(
						point.y.equals(origin.y)
						?
							["h", point.x]
						:
							["l", point.x, point.y]
					);
				if(top)
				{
					if(context.optimisation.path.combineCommands && result.sequence.length > 0)
					{
						last = result.sequence[result.sequence.length - 1];
						if(last[0].toLowerCase() === top[0].toLowerCase() && lastAngle === result.lastAngle)
						{
							if(relative)
							{
								if(last.length > 2)
									last[2] = last[2].add(top[2]);
								last[1] = last[1].add(top[1]);
								top = null;
							}
							else
								result.sequnce.pop();
						}
					}
					result.lastAngle = lastAngle;
				}
				break;
			case "m":
			case "t":
				point =
				{
					x: top[1].value,
					y: top[2].value
				}
				if(angle)
					point = PathParser.#rotate(origin.x, origin.y, point.x, point.y, angle);
				if(top[1].fixed)
					point.x = relative ? top[1].value.subtract(result.x) : top[1].value;
				if(top[2].fixed)
					point.y = relative ? top[2].value.subtract(result.y) : top[2].value;
				top = [top[0], point.x, point.y];
				if(context.optimisation.path.combineCommands && command === "m" && result.sequence.length > 0)
				{
					last = result.sequence[result.sequence.length - 1];
					if(last[0].toLowerCase() === "m")
					{
						if(relative)
						{
							last[1] = last[1].add(top[1]);
							last[2] = last[2].add(top[2]);
							top = null;
						}
						else
							result.sequnce.pop();
					}
				}
				break;
			case "z":
				top = ["z"];
				result.x = new BigDecimal(result.originX);
				result.y = new BigDecimal(result.originY);
				result.lastAngle = null;
				break;
		}
		if(command !== "z")
		{
			result.x = relative ? result.x.add(point.x) : point.x;
			result.y = relative ? result.y.add(point.y) : point.y;
		}
		if(command === "m")
		{
			result.originX = new BigDecimal(result.x);
			result.originY = new BigDecimal(result.y);
		}
		if(top)
		{
			if(!relative)
				top[0] = top[0].toUpperCase();
			/* TODO: Primitive optimiser someday? */
			result.sequence.push(top);
		}

		return;
	}

	parseList(context, result = Value.getEmptyResult(), limit)
	{
		let state;
		let top;
		let invoked;
		let next;

		state =
		{
			current: this.stream.getCurrent(),
			reading: true,
			index: 0
		};
		top = [];

		while(state.reading && state.current && state.index < limit)
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

	parse(context, result = Value.getEmptyResult(), rotate = new BigDecimal(0), index = 1, argumentList)
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

		while(state.reading && state.current)
		{
			switch(state.current.type)
			{
				case Token.TYPE_COMMAND:
					if(result.arity === null && state.current.name.toLowerCase() !== "m")
						throw(new SyntaxError("Paths must begin with a Move To command"));
					if(top)
						PathParser.#applyRotation(context, top, result, rotate);
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
						PathParser.#applyRotation(context, top, result, rotate);
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
							PathParser.#applyRotation(context, top, result, rotate);
							top = null;
						}
						new ExpressionParser(this.stream).parseInvocation(context, result, argumentList);
						state.current = this.stream.getCurrent();
						continue;
					}
				default:
					if(!top)
						throw(new Error(`Expected command, but found "${state.current.name}"`));
					if(!result.pending)
					{
						PathParser.#applyRotation(context, top, result, rotate);
						result.pending = result.arity.length;
						top = [top[0]];
					}
					if(!result.pending)
						throw(new SyntaxError(`Too many parameters supplied to command "${top[0]}"`));;
					if(top[0].toLowerCase() === "a" && (result.pending === 4 || result.pending === 3) && state.current.type === Token.TYPE_NUMBER && state.current.name.length > 1 && ["0", "1"].indexOf(state.current.name.substr(0, 1)) !== -1)
					{
						top.push({fixed: result.fixNext, value: new BigDecimal(state.current.name.substr(0, 1))});
						state.current.name = state.current.name.substr(1);
						state.current.value = new BigDecimal(state.current.name);
					}
					else
					{
						let expResult = new ExpressionParser(this.stream).parse(context, 0, argumentList, false, {x: result.x, y: result.y}, result.arity[result.arity.length - result.pending]);
						top.push({fixed: result.fixNext, value: expResult.accumulator});
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
