import 'fs';

class Token
{
    static TYPE_NUMBER                    = 1;
    static TYPE_COMMAND                   = 2;
    static TYPE_DELIMITER                 = 3;
    static TYPE_WHITESPACE                = 4;
    static TYPE_IDENTIFIER                = 5;
    static TYPE_BRACKET                   = 6;
    static TYPE_END                       = 7;
    static TYPE_OPERATOR_ADD              = 8;
    static TYPE_OPERATOR_SUBTRACT         = 9;
    static TYPE_OPERATOR_MULTIPLY         = 10;
    static TYPE_OPERATOR_DIVIDE           = 11;
    static TYPE_OPERATOR_ROTATE           = 12;
    static TYPE_OPERATOR_SKEW_HORIZONTAL  = 13;
    static TYPE_OPERATOR_SKEW_VERTICAL    = 14;
    static TYPE_OPERATOR_REVERSE_ORDER    = 15;
    static TYPE_OPERATOR_FIX              = 16;
    static TYPE_OPERATOR_MEASURE          = 17;
    static TYPE_OPERATOR_ASSIGN           = 18;
    static TYPE_OPERATOR_REPEAT           = 19;

    constructor(type, name, value, position)
    {
        this.type = type;
        this.name = name;
        this.value = value;
        this.position = position;
    }

    static nameOf(type)
    {
        return(Object.entries(Token).filter(([key, value]) => value === type)[0][0]);
    }
}

class BigDecimal
{
    static LIMIT_PRECISION         = 18;
    static PI                      = new BigDecimal("3.141592653589793238");
    static #VALUE_SHIFT            = BigInt("1" + "0".repeat(BigDecimal.LIMIT_PRECISION));
    static #PATTERN_TRAILING_ZERO  = new RegExp("\\.?0+$");

    #value;

    constructor(source = 0)
	{
		let integerPart;
		let decimalPart;

		if(source instanceof BigDecimal)
            this.#value = source.#value;
		else
            if(source instanceof BigInt)
                this.#value = value * BigDecimal.VALUE_SHIFT;
            else
            {
                [integerPart, decimalPart] = (source + ".").split(".");
                this.#value = BigInt(integerPart + decimalPart.substr(0, BigDecimal.LIMIT_PRECISION).padEnd(BigDecimal.LIMIT_PRECISION, "0"));
                if(decimalPart.charCodeAt(BigDecimal.LIMIT_PRECISION) > 52)
                    this.#value++;
            }

		return;
    }

    #fromBigInt(source)
    {
        let result;

        result = new BigDecimal(this);
        result.#value = source;

        return(result);
    }

    #fromBigIntDivision(dividend, divisor)
    {
        return(this.#fromBigInt(dividend / divisor + dividend * 2n / divisor % 2n));
    }

    add(other)
    {
        return(this.#fromBigInt(this.#value + new BigDecimal(other).#value));
    }

    subtract(other)
    {
        return(this.#fromBigInt(this.#value - new BigDecimal(other).#value));
    }

    multiplyBy(other)
    {
        return(this.#fromBigIntDivision(this.#value * new BigDecimal(other).#value, BigDecimal.#VALUE_SHIFT));
    }

    divideBy(other)
    {
        return(this.#fromBigIntDivision(this.#value * BigDecimal.#VALUE_SHIFT, new BigDecimal(other).#value));
    }

    equals(other)
    {
        return(this.valueOf() == other);
    }

    valueOf()
    {
        return(this.#value);
    }

    toNumber()
    {
        return(+this.toString());
    }

    toString(precision = BigDecimal.LIMIT_PRECISION)
    {
        let text;

        text = this.#fromBigIntDivision(this.#value, BigInt("1" + "0".repeat(precision > -1 ? Math.max(BigDecimal.LIMIT_PRECISION - precision, 0) : BigDecimal.LIMIT_PRECISION))).#value.toString();
        if(text.startsWith("-"))
            text = "-" + text.substr(1).padStart(precision + 1, "0");
        else
            text = text.padStart(precision + 1, "0");

        return(text.substr(0, text.length - precision) + ("." + text.substr(-precision)).replace(BigDecimal.#PATTERN_TRAILING_ZERO, ""));
    }
}

class Value
{
	static TYPE_X        = 1;
	static TYPE_Y        = 2;
	static TYPE_THETA    = 3;
	static TYPE_FLAG     = 4;
	static TYPE_UNIT     = 5;

	static getEmptyResult()
	{
		return(
		{
			stack: [],
			sequence: [],
			arity: null,
			pending: 0,
			x: new BigDecimal(0),
			y: new BigDecimal(0),
			fixNext: false,
			lastAngle: null,
			originX: new BigDecimal(0),
			originY: new BigDecimal(0) 
		});
	}
}

class TokenStream
{
    static #PRIORITY =
    [
        {
            type: Token.TYPE_NUMBER,
            expression: new RegExp("^[0-9]*\\.?[0-9]+", ""),
            handler: value => new BigDecimal(value)
        },
        {
            type: Token.TYPE_COMMAND,
            expression: new RegExp("^[achlmqstvz](?![a-z_$])", "i"),
            handler: value => (
            {
                "a":
                [
                    Value.TYPE_X,
                    Value.TYPE_Y,
                    Value.TYPE_THETA,
                    Value.TYPE_FLAG,
                    Value.TYPE_FLAG,
                    Value.TYPE_X,
                    Value.TYPE_Y
                ],
                "c":
                [
                    Value.TYPE_X,
                    Value.TYPE_Y,
                    Value.TYPE_X,
                    Value.TYPE_Y,
                    Value.TYPE_X,
                    Value.TYPE_Y
                ],
                "h":
                [
                    Value.TYPE_X
                ],
                "l":
                [
                    Value.TYPE_X,
                    Value.TYPE_Y
                ],
                "m":
                [
                    Value.TYPE_X,
                    Value.TYPE_Y
                ],
                "q":
                [
                    Value.TYPE_X,
                    Value.TYPE_Y,
                    Value.TYPE_X,
                    Value.TYPE_Y
                ],
                "s":
                [
                    Value.TYPE_X,
                    Value.TYPE_Y,
                    Value.TYPE_X,
                    Value.TYPE_Y
                ],
                "t":
                [
                    Value.TYPE_X,
                    Value.TYPE_Y
                ],
                "v":
                [
                    Value.TYPE_Y
                ],
                "z":
                [
                ]
            }[value.toLowerCase()])
        },
        {
            type: Token.TYPE_DELIMITER,
            expression: new RegExp("^,+", ""),
            handler: () => null
        },
        {
            type: Token.TYPE_WHITESPACE,
            expression: new RegExp("^\\s+", ""),
            handler: () => null
        },
        {
            type: Token.TYPE_IDENTIFIER,
            expression: new RegExp("^[a-z_$][a-z0-9_$]*", "i"),
            handler: value => value
        },
        {
            type: Token.TYPE_BRACKET,
            expression: new RegExp("^[()]", ""),
            handler: value => value === "("
        },
        {
            type: Token.TYPE_OPERATOR_ADD,
            expression: new RegExp("^\\+", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_MULTIPLY,
            expression: new RegExp("^\\*", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_SUBTRACT,
            expression: new RegExp("^-", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_DIVIDE,
            expression: new RegExp("^/", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_ROTATE,
            expression: new RegExp("^%r", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_SKEW_HORIZONTAL,
            expression: new RegExp("^%h", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_SKEW_VERTICAL,
            expression: new RegExp("^%v", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_REVERSE_ORDER,
            expression: new RegExp("^%o", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_FIX,
            expression: new RegExp("^@", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_MEASURE,
            expression: new RegExp("^\\|", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_ASSIGN,
            expression: new RegExp("^=", ""),
            handler: value => value
        },
        {
            type: Token.TYPE_OPERATOR_REPEAT,
            expression: new RegExp("^#", ""),
            handler: value => value
        }
    ];

    #data = null;
    #cursor = 0;

    constructor(text)
    {
        var chainIndex;
        var streamIndex;
        var match;
        var item;

        this.#data = [];
        streamIndex = 0;
        while(text.length)
        {
            for(chainIndex = 0; chainIndex < TokenStream.#PRIORITY.length; chainIndex++)
            {
                item = TokenStream.#PRIORITY[chainIndex];
                match = item.expression.exec(text);
                if(match)
                {
                    this.#data.push(new Token(item.type, match[0], item.handler(match[0]), streamIndex));
                    streamIndex += match[0].length;
                    text = text.substr(match[0].length);
                    break;
                }
            }
            if(chainIndex === TokenStream.#PRIORITY.length)
				throw(new SyntaxError(`Unexpected symbol "${text.substr(0, 1)}" at column ${streamIndex}`));
        }
        this.#data.push(new Token(Token.TYPE_END, null, null, streamIndex));
    }

    getCurrent()
    {
        return(this.#data[this.#cursor] ?? null);
    }

    getNext()
    {
        this.#cursor++;

        return(this.getCurrent());
    }

    peekNext()
    {
        return(this.#data[this.#cursor + 1] ?? null);
    }

    reset()
    {
        this.#cursor = 0;

        return(this.getCurrent());
    }
}

class Distortion
{
	static OPERATION_ROTATE = 1;
	static OPERATION_SKEW_HORIZONTAL = 2;
	static OPERATION_SKEW_VERTICAL = 3;
	static OPERATION_REVERSE_ORDER = 4;

	constructor(type, value)
	{
		this.type = type;
		this.value = value;

		return;
	}

	#getName()
	{
		return(
		({
			[Distortion.OPERATION_ROTATE]: "Rotate",
			[Distortion.OPERATION_SKEW_HORIZONTAL]: "Vertical skew",
			[Distortion.OPERATION_SKEW_VERTICAL]: "Horizontal skew",
			[Distortion.OPERATION_REVERSE_ORDER]: "Reverse order"
		})[this.type] ?? "Unknown");
	}

	toString()
	{
		return(`${this.#getName()}: ${this.value}`);
	}

	run(x0, y0, x1, y1)
	{
		let result;
		let distortionValue;

		switch(this.type)
		{
			case Distortion.OPERATION_ROTATE:
				let cosine;
				let sine;
		
				x1 = x1.subtract(x0);
				y1 = y1.subtract(y0);
				distortionValue = (this.value.toNumber() % 360) * Math.PI / 180;
				cosine = Math.cos(distortionValue);
				sine = Math.sin(distortionValue);
				if(Math.abs(cosine - sine) < Number.EPSILON * 2)
					sine = cosine;
				else
					if(Math.abs(cosine + sine) < Number.EPSILON * 2)
						cosine = sine;
				if(Math.abs(cosine) < Number.EPSILON)
					cosine = 0;
				if(Math.abs(sine) < Number.EPSILON)
					sine = 0;
			
				result =
				{
					x: x0.add(x1.multiplyBy(cosine)).subtract(y1.multiplyBy(sine)),
					y: y0.add(y1.multiplyBy(cosine)).add(x1.multiplyBy(sine))
				};
				break;
			case Distortion.OPERATION_SKEW_HORIZONTAL:
				result =
				{
					x: x0.add(x1.subtract(x0).subtract(y1.multiplyBy(Math.tan((this.value.toNumber() % 360) * Math.PI / 180)))),
					y: y1
				};
				break;
			case Distortion.OPERATION_SKEW_VERTICAL:
				result =
				{
					x: x1,
					y: y0.add(y1.subtract(y0).subtract(x1.multiplyBy(Math.tan((distortionValue.toNumber() % 360) * Math.PI / 180))))
				};
				break;
			case Distortion.OPERATION_REVERSE_ORDER:
				result =
				{
					x: x1,
					y: y1
				};
				break;
		}

		return(result);
	}

	static runStack(x0, y0, x1, y1, distortionStack)
	{
		return(distortionStack.reduceRight((carry, item) => item.run(x0, y0, carry.x, carry.y), {x: x1, y: y1}));
	}

	static #fixPoint(point, relative, topX, topY, result)
	{
		if(topX.fixed)
			point.x = relative ? topX.value.subtract(result.x) : topX.value;
		if(topY.fixed)
			point.y = relative ? topY.value.subtract(result.y) : topY.value;

		return;
	}

	static applyDistortion(context, top, result, distortionStack)
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
		};
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
				if(distortionStack.length)
					point = Distortion.runStack(origin.x, origin.y, point.x, point.y, distortionStack);
				Distortion.#fixPoint(point, relative, top[6], top[7], result);
				top =
				[
					top[0],
					top[1].value,
					top[2].value,
					top[3].fixed ? top[3].value : distortionStack.reduceRight((carry, item) =>
					{
						return(item.type === Distortion.OPERATION_ROTATE ? carry.add(item.value) : carry);
					}, top[3].value),
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
				if(distortionStack.length)
				{
					point1 = Distortion.runStack(origin.x, origin.y, point1.x, point1.y, distortionStack);
					point2 = Distortion.runStack(origin.x, origin.y, point2.x, point2.y, distortionStack);
					point = Distortion.runStack(origin.x, origin.y, point.x, point.y, distortionStack);
				}
				Distortion.#fixPoint(point, relative, top[5], top[6], result);
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
				if(distortionStack.length)
				{
					point1 = Distortion.runStack(origin.x, origin.y, point1.x, point1.y, distortionStack);
					point = Distortion.runStack(origin.x, origin.y, point.x, point.y, distortionStack);
				}
				Distortion.#fixPoint(point, relative, top[3], top[4], result);
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
				let topX = command === "v" ? {value: new BigDecimal(origin.x), fixed: top[1].fixed} : top[1];
				let topY = command === "h" ? {value: new BigDecimal(origin.y), fixed: top[1].fixed} : (command === "v" ? top[1] : top[2]);
				point =
				{
					x: topX.value,
					y: topY.value
				};
				if(distortionStack.length)
					point = Distortion.runStack(origin.x, origin.y, point.x, point.y, distortionStack);
				lastAngle = Math.atan2(point.y.subtract(origin.y).toNumber(), point.x.subtract(origin.x).toNumber()) * 180 / Math.PI;
				Distortion.#fixPoint(point, relative, topX, topY, result);
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
				};
				if(distortionStack.length)
					point = Distortion.runStack(origin.x, origin.y, point.x, point.y, distortionStack);
				Distortion.#fixPoint(point, relative, top[1], top[2], result);
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
			const reverseList = distortionStack.filter(item => item.type === Distortion.OPERATION_REVERSE_ORDER);
			if(reverseList.length % 2)
				result.sequence.splice(reverseList[0].value.toNumber(), 0, top);
			else
				result.sequence.push(top);
		}

		return;
	}
}

class PathParser
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

		state =
		{
			current: this.stream.getCurrent(),
			reading: true,
			index: 0
		};

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
					if(![false, null, undefined].includes(invoked))
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

class ExpressionParser
{
    static #OPERATION_EVALUATE  = 1;
    static #OPERATION_ADD       = 2;
    static #OPERATION_SUBTRACT  = 3;
    static #OPERATION_MULTIPLY  = 4;
    static #OPERATION_DIVIDE    = 5;

    constructor(stream)
    {
        this.stream = stream;
		this.debug = false;
    }

    static #formatOperation(operation)
    {
		return(operation.value.toString() + " " + ["", "=", "+", "-", "*", "/"][operation.operation]);
	}

    #unwind(result, limit)
    {
		var start;
		var index;
		var leftValue;
		var leftOperation;

		start = result.stack.length - 1;
		while(start > -1 && result.stack[start].operation > limit)
			start--;
		index = start + 1;
		if(index < result.stack.length)
		{
			result.stack.push({operation: ExpressionParser.#OPERATION_EVALUATE, value: result.accumulator});
			if(this.debug)
				console.log("<<\n" + result.stack.slice(index).map((i, j) => j + ": " + ExpressionParser.#formatOperation(i)).join("\n"));
			leftValue = result.stack[index].value;
			for(; index < result.stack.length - 1; index++)
			{
				leftOperation = result.stack[index].operation;
				switch(leftOperation)
				{
					case ExpressionParser.#OPERATION_MULTIPLY:
						leftValue = leftValue.multiplyBy(result.stack[index + 1].value);
						break;
					case ExpressionParser.#OPERATION_DIVIDE:
						leftValue = leftValue.divideBy(result.stack[index + 1].value);
						break;
					case ExpressionParser.#OPERATION_ADD:
						leftValue = leftValue.add(result.stack[index + 1].value);
						break;
					case ExpressionParser.#OPERATION_SUBTRACT:
						leftValue = leftValue.subtract(result.stack[index + 1].value);
						break;
				}
			}
			result.accumulator = leftValue;
			result.stack = result.stack.slice(0, start + 1);
		}

		return;
	}

    parse(context, depth = 0, argumentList = {}, insideArgumentList = false, position, type, additionalTerminatorList = [])
    {
		var result;
		var state;

		result =
		{
			accumulator: new BigDecimal(0),
			base: 0,
			counter: depth,
			data: 0,
			stack: []
		};
		state =
		{
			current: this.stream.getCurrent(),
			reading: true
		};

		while(state.reading && state.current)
		{
			switch(state.current.type)
			{
				case Token.TYPE_NUMBER:
					if(result.data === Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected space-delimited value "${state.current.name}" at column ${state.current.position}`));
					if(result.data === Token.TYPE_NUMBER)
						if(result.counter)
							throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
						else
						{
							state.reading = false;
							continue;
						}
					if(this.debug)
						console.log("Number", state.current);
					result.accumulator = state.current.value;
					result.data = Token.TYPE_NUMBER;
					break;
				case Token.TYPE_OPERATOR_DIVIDE:
					if(result.data !== Token.TYPE_NUMBER && result.data !== Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
					if(this.debug)
						console.log("/", state.current);
					result.stack.push({operation: ExpressionParser.#OPERATION_DIVIDE, value: result.accumulator});
					result.data = Token.TYPE_OPERATOR_DIVIDE;
					break;
				case Token.TYPE_OPERATOR_MULTIPLY:
					if(result.data !== Token.TYPE_NUMBER && result.data !== Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
					if(this.debug)
						console.log("*", state.current);
					result.stack.push({operation: ExpressionParser.#OPERATION_MULTIPLY, value: result.accumulator});
					result.data = Token.TYPE_OPERATOR_MULTIPLY;
					break;
				case Token.TYPE_OPERATOR_SUBTRACT:
					if(result.data === Token.TYPE_NUMBER && result.counter === 0)
					{
						state.reading = false;
						continue;
					}
					if(result.data !== Token.TYPE_NUMBER && result.data !== 0 && result.data !== Token.TYPE_BRACKET && result.data !== Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
					if(this.debug)
						console.log("-", state.current);
					this.#unwind(result, ExpressionParser.#OPERATION_SUBTRACT);
					result.stack.push({operation: ExpressionParser.#OPERATION_SUBTRACT, value: result.accumulator});
					result.data = Token.TYPE_OPERATOR_SUBTRACT;
					break;
				case Token.TYPE_OPERATOR_ADD:
					if(result.data !== Token.TYPE_NUMBER && result.data !== Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
					if(this.debug)
						console.log("+", state.current);
					this.#unwind(result, ExpressionParser.#OPERATION_SUBTRACT);
					result.stack.push({operation: ExpressionParser.#OPERATION_ADD, value: result.accumulator});
					result.data = Token.TYPE_OPERATOR_ADD;
					break;
				case Token.TYPE_OPERATOR_MEASURE:
					if(result.data === Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected space before measure operator ("${state.current.name}") at column ${state.current.position}`));
					if(result.data === Token.TYPE_NUMBER)
					{
						if(this.debug)
							console.log("*", state.current);
						result.stack.push({operation: ExpressionParser.#OPERATION_MULTIPLY, value: result.accumulator});
					}
					if(type === Value.TYPE_UNIT)
						throw(new SyntaxError(`The unit type is incompatible with the return value of a segment measurement`));
					if(type === Value.TYPE_FLAG)
						throw(new SyntaxError(`The flag type is incompatible with the return value of a segment measurement`));
					this.stream.getNext();
					if(this.stream.getCurrent().type === Token.TYPE_WHITESPACE)
						this.stream.getNext();
					if(this.stream.getCurrent().type !== Token.TYPE_IDENTIFIER)
						throw(new SyntaxError(`Expected identifier at ${this.stream.getCurrent().position}, found "${this.stream.getCurrent().name}"`))
					let expResult = Value.getEmptyResult();
					expResult.x = position.x;
					expResult.y = position.y;
					expResult.arity = [];
					new ExpressionParser(this.stream).parseInvocation(context, expResult, argumentList, []);
					result.data = Token.TYPE_NUMBER;
					switch(type)
					{
						case Value.TYPE_X:
							result.accumulator = expResult.x.subtract(position.x);
							console.log("RETURNING X", result.accumulator.toString());
							break;
						case Value.TYPE_Y:
							result.accumulator = expResult.y.subtract(position.y);
							console.log("RETURNING Y", result.accumulator.toString());
							break;
						case Value.TYPE_THETA:
							result.accumulator = (new BigDecimal(Math.atan2(expResult.x.subtract(position.x).toNumber(), expResult.y.subtract(position.y).toNumber()))).multiplyBy(180).divideBy(BigDecimal.PI);
							console.log("RETURNING THETA", result.accumulator.toString());
							break;
					}
					if(this.stream.getCurrent().type === Token.TYPE_WHITESPACE)
						this.stream.getNext();
					state.current = this.stream.getCurrent();
					if(state.current.type !== Token.TYPE_OPERATOR_MEASURE)
						throw(new SyntaxError(`Expected measurement operator, found "${state.current.name}`));
					break;
				case Token.TYPE_BRACKET:
					if(this.debug)
						console.log(state.current.value ? "(" : ")", state.current, result.counter, context.depth);
					if(state.current.value)
					{
						if(result.data === Token.TYPE_WHITESPACE)
							throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
						result.counter++;
						if(result.data === Token.TYPE_NUMBER)
						{
							if(this.debug)
								console.log("*", state.current);
							result.stack.push({operation: ExpressionParser.#OPERATION_MULTIPLY, value: result.accumulator});
						}
						result.accumulator = new BigDecimal(0);
						result.stack.push({operation: ExpressionParser.#OPERATION_EVALUATE});
						result.data = Token.TYPE_BRACKET;
					}
					else
					{
						if(!insideArgumentList && result.counter === context.depth)
							throw(new SyntaxError(`Mismatched bracket at column ${state.current.position}`));
						if(result.data !== Token.TYPE_NUMBER)
							throw(new SyntaxError(`Unexpected bracket at column ${state.current.position}`));
						this.#unwind(result, ExpressionParser.#OPERATION_SUBTRACT);
						this.#unwind(result, ExpressionParser.#OPERATION_EVALUATE);
						result.stack.pop();
						result.data = Token.TYPE_NUMBER;
						if(insideArgumentList)
						{
							state.reading = false;
							continue;
						}
						else
							result.counter--;
					}
					break;
				case Token.TYPE_IDENTIFIER:
					if(result.data === Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected space-delimited value "${state.current.name}" at column ${state.current.position}`));
					if(state.current.name in argumentList || state.current.name in context.unit)
					{
						if(result.data === Token.TYPE_NUMBER)
						{
							if(this.debug)
								console.log("*", state.current);
							result.stack.push({operation: ExpressionParser.#OPERATION_MULTIPLY, value: result.accumulator});
						}
						if(this.debug)
							console.log("Unit", state.current);
						result.accumulator = argumentList[state.current.name] ?? context.unit[state.current.name];
						result.data = Token.TYPE_NUMBER;
					}
					else
						throw(new ReferenceError(`Reference to undefined unit "${state.current.name}" at column ${state.current.position}.`));
					break;
				case Token.TYPE_DELIMITER:
					if(result.counter)
						throw(new SyntaxError(`Unexpected delimiter "${state.current.name}" in expression at column ${state.current.position}.`));
				case Token.TYPE_WHITESPACE:
					if(result.counter || result.data === 0) // TODO
					{
						if(result.data === Token.TYPE_NUMBER)
							result.data = Token.TYPE_WHITESPACE;
						break;
					}
				case Token.TYPE_END:
					if(result.counter > context.depth)
						throw(new SyntaxError(`Missing closing bracket(s) at end of segment (nesting depth = ${result.counter - context.depth})`));
					state.reading = false;
					continue;
				default:
					if(additionalTerminatorList.includes(state.current.type))
					{
						state.reading = false;
						continue;
					}
					throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
			}
			state.current = this.stream.getNext();
		}
		this.#unwind(result, ExpressionParser.#OPERATION_SUBTRACT);
		this.#unwind(result, 0);

		return(result);
	}

	parseInvocation(context, result, argumentList, distortionStack)
	{
		let state;
		let segment;
		let inner;
		let name;
		let index;
		let expResult;
		let type;
	
		state =
		{
			current: this.stream.getCurrent(),
			reading: true,
			hasCount: false,
			hasArgumentList: false,
			distortionStack: distortionStack,
			count: false,
			argumentList: {},
			delimited: false
		};
	
		if(state.current.type === Token.TYPE_NUMBER)
		{
			state.count = state.current.value.toNumber();
			state.hasCount = true;
			state.current = this.stream.getNext();
		}
		else
			state.count = 1;
		name = state.current.name;
		if(result.stack.indexOf(name) === -1)
		{
			if(!(name in context.segment))
				throw(new ReferenceError(`Reference to undefined section "${name}" at ${state.current.position}`));
			segment = context.segment[name];
			state.current = this.stream.getNext();
			while(state.reading === true && state.current)
			{
				switch(state.current.type)
				{
					case Token.TYPE_OPERATOR_ROTATE:
					case Token.TYPE_OPERATOR_SKEW_HORIZONTAL:
					case Token.TYPE_OPERATOR_SKEW_VERTICAL:
						this.stream.getNext();
						expResult = new ExpressionParser(this.stream).parse(context, 0, argumentList, false, {x: result.x, y: result.y}, Value.TYPE_THETA, [Token.TYPE_OPERATOR_ROTATE, Token.TYPE_OPERATOR_SKEW_HORIZONTAL, Token.TYPE_OPERATOR_SKEW_VERTICAL]);
						state.distortionStack.push(new Distortion(
						({
							[Token.TYPE_OPERATOR_ROTATE]: Distortion.OPERATION_ROTATE,
							[Token.TYPE_OPERATOR_SKEW_HORIZONTAL]: Distortion.OPERATION_SKEW_HORIZONTAL,
							[Token.TYPE_OPERATOR_SKEW_VERTICAL]: Distortion.OPERATION_SKEW_VERTICAL
						})[state.current.type], expResult.accumulator));
						state.current = this.stream.getCurrent();
						continue;
					case Token.TYPE_OPERATOR_REVERSE_ORDER:
						state.distortionStack.push(new Distortion(Distortion.OPERATION_REVERSE_ORDER, null));
						break;
					case Token.TYPE_BRACKET:
						if(!state.hasArgumentList)
						{
							if(state.current.value)
							{
								state.current = this.stream.getNext();
								while(!state.hasArgumentList)
								{
									switch(state.current.type)
									{
										case Token.TYPE_BRACKET:
											if(state.current.value)
												throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
											state.hasArgumentList = true;
											continue;
										case Token.TYPE_IDENTIFIER:
										case Token.TYPE_OPERATOR_ROTATE:
										case Token.TYPE_OPERATOR_REPEAT:
										case Token.TYPE_OPERATOR_SKEW_HORIZONTAL:
										case Token.TYPE_OPERATOR_SKEW_VERTICAL:
											state.delimited = false;
											name = state.current.name;
											type = state.current.type;
											switch(type)
											{
												case Token.TYPE_IDENTIFIER:
													if(context.segment[name])
														throw(new ReferenceError(`Argument "${name}" is already defined as a segment`));
													break;
												case Token.TYPE_OPERATOR_REPEAT:
													if(state.hasCount)
														throw(new ReferenceError(`Execution count is already defined for this invocation`));
													break;
											}
											if(this.stream.peekNext().type === Token.TYPE_WHITESPACE)
												state.current = this.stream.getNext();
											state.current = this.stream.getNext();
											if(state.current.type === Token.TYPE_END)
												throw(new Error(`Unexpected end of segment at ${state.current.position}`));
											if(state.current.type !== Token.TYPE_OPERATOR_ASSIGN)
												throw(new SyntaxError(`Expected assignment operator after argument name, but found "${state.current.name}"`));
											state.current = this.stream.getNext();
											expResult = new ExpressionParser(this.stream).parse(context, 0, argumentList, true, {x: result.x, y: result.y},
											{
												[Token.TYPE_IDENTIFIER]: Value.TYPE_UNIT,
												[Token.TYPE_OPERATOR_ROTATE]: Value.TYPE_THETA,
												[Token.TYPE_OPERATOR_SKEW_HORIZONTAL]: Value.TYPE_THETA,
												[Token.TYPE_OPERATOR_SKEW_VERTICAL]: Value.TYPE_THETA,
												[Token.TYPE_OPERATOR_REPEAT]: Value.TYPE_UNIT,
											}[type]);
											switch(type)
											{
												case Token.TYPE_IDENTIFIER:
													state.argumentList[name] = expResult.accumulator;
													break;
												case Token.TYPE_OPERATOR_ROTATE:
												case Token.TYPE_OPERATOR_SKEW_HORIZONTAL:
												case Token.TYPE_OPERATOR_SKEW_VERTICAL:
													state.distortionStack.push(new Distortion(
													({
														[Token.TYPE_OPERATOR_ROTATE]: Distortion.OPERATION_ROTATE,
														[Token.TYPE_OPERATOR_SKEW_HORIZONTAL]: Distortion.OPERATION_SKEW_HORIZONTAL,
														[Token.TYPE_OPERATOR_SKEW_VERTICAL]: Distortion.OPERATION_SKEW_VERTICAL
													})[type], expResult.accumulator));
													break;
												case Token.TYPE_OPERATOR_REPEAT:
													state.count = expResult.accumulator.toNumber();
													state.hasCount = true;
													break;
											}
											state.current = this.stream.getCurrent();
											continue;
										case Token.TYPE_DELIMITER:
											if(state.delimited)
												throw(new Error(`Unexpected delimiter at column ${state.current.position}`));
											state.delimited = true;
										case Token.TYPE_WHITESPACE:
											break;
										case Token.TYPE_END:
											throw(new Error(`Unexpected end of segment at ${state.current.position}`));
										default:
											throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
									}
									state.current = this.stream.getNext();
								}
							}
							else
								throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
						}
						else
						{
							state.reading = false;
							continue;
						}
						break;
					case Token.TYPE_WHITESPACE:
						if([Token.TYPE_OPERATOR_ROTATE, Token.TYPE_OPERATOR_SKEW_HORIZONTAL, Token.TYPE_OPERATOR_SKEW_VERTICAL].includes(this.stream.peekNext().type))
							break;
					default:
						state.reading = false;
						continue;
				}
				state.current = this.stream.getNext();
			}
			if(state.count !== parseInt(state.count))
				throw(new Error(`The execution count (${state.count}) for segment "${name}" must be an integer.`));
			if(state.count < 1)
				throw(new Error(`The execution count (${state.count}) for segment "${name}" can't be less than 1.`));
			for(index = 1; index <= state.count; index++)
			{
				inner = new PathParser(new TokenStream(segment));
				inner.parse(context, result, state.distortionStack.concat(), index, state.argumentList);
				result.stack.pop();
			}
			state.reading = false;
		}
		else
			throw(new ReferenceError(`Segment ${state.current.name} cannot call itself`));
	
		return;
	}
}

class ExtendedDOM
{
	static typeof(node)
	{
		return(node && node.constructor ? node.constructor.name.toLowerCase() : undefined);
	}

	static extractChildren(element, clean = true)
	{
		if(clean && ExtendedDOM.typeof(element.firstChild) === "text")
			element.removeChild(element.firstChild);
		while(element.firstChild)
			element.parentNode.insertBefore(element.firstChild, element);
		element.parentNode.removeChild(element);

		return;
	}

	static remove(element, clean = true)
	{
		if(clean && ExtendedDOM.typeof(element.previousSibling) === "text")
			element.parentNode.removeChild(element.previousSibling);
		element.parentNode.removeChild(element);

		return;
	}
}

class Transformer
{
	constructor(text)
	{
		this.document = Transformer.#parseXML(text);
	}

	static #parseXML(text)
	{
		return((new (typeof(DOMParser) === "undefined" ? require('xmldom').DOMParser : DOMParser)()).parseFromString(text, "text/xml"));
	}

	static #parseMeta(document)
	{
		let defined = Array.from(document.getElementsByTagName("define"));
		defined.forEach(element => element.parentNode.removeChild(element));
		defined = defined.filter(item =>
				["t", "true", "on", "yes", "y"].includes(item.getAttribute("state").toLowerCase())
				||
				(parseFloat(item.getAttribute("state")) || 0) !== 0
			)
			.map(item => item.getAttribute("name"));
		Array.from(document.getElementsByTagName("ifdef")).forEach(element =>
		{
			if(defined.includes(element.getAttribute("name")))
				ExtendedDOM.extractChildren(element);
			else
				ExtendedDOM.remove(element);

			return;
		});
		Array.from(document.getElementsByTagName("ifndef")).forEach(element =>
		{
			if(defined.includes(element.getAttribute("name")))
				ExtendedDOM.remove(element);
			else
				ExtendedDOM.extractChildren(element);

			return;
		});
	
		return;
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

		return;
	}

	static #parseLiteralList(context, list)
	{
		let item;

		while(list.length)
		{
			item = list.shift();
			if(!item.previousSibling.tagName && item.previousSibling.nodeValue.trim() === "")
				item.parentNode.removeChild(item.previousSibling);
			item.parentNode.removeChild(item);
			let id = item.getAttribute("id");
			if(id in context.unit)
				throw(new Error(`Duplicate literal ID: "${id}"`));
			context.literal[id] = item.getAttribute("value");
		}

		return;
	}

	static #parseSegmentList(context, list)
	{
		list.forEach(i =>
		{
			if(!i.previousSibling.tagName && i.previousSibling.nodeValue.trim() === "")
				i.parentNode.removeChild(i.previousSibling);
			i.parentNode.removeChild(i);

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

		return;
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

		return;
	}

	static #insertTemplateContent(template, replacement, iif, context, container)
	{
		Object.entries(replacement).forEach(([replaceKey, replaceValue]) =>
			iif = iif.replaceAll(replaceKey, replaceValue)
		);
		if(!iif.length || Object.keys(context.segment).includes(iif))
		{
			const copy = template.cloneNode(true);
			const list = Array.from(copy.getElementsByTagName("*"));
			list.forEach(element =>
			{
				Array.from(element.attributes).forEach(attribute =>
					Object.entries(replacement).forEach(([replaceKey, replaceValue]) =>
						attribute.value = attribute.value.replaceAll(replaceKey, replaceValue)
					)
				);
				iif = element.getAttribute("if");
				if(iif.length && !Object.keys(context.segment).includes(iif))
					element.parentNode.removeChild(element);
				element.removeAttribute("if");

				return;
			});
			if(copy.firstChild && !copy.firstChild.tagName && copy.firstChild.nodeValue.trim() === "")
					copy.removeChild(copy.firstChild);
			if(!container)
				while(copy.firstChild)
					template.parentNode.insertBefore(copy.firstChild, template);
			else
				while(copy.firstChild)
					container.appendChild(copy.firstChild);
		}

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

	static #getTemplateLiteral(context, template, attribute)
	{
		const value = template.getAttribute(attribute);

		return(context.literal[value] ?? value);
	}

	static #applyTemplate(context, document)
	{
		let template = document.getElementsByTagName("template")[0];
		while(template)
		{
			switch(template.getAttribute("type"))
			{
				case "repeat":
					let minimum;
					let maximum;
					let loop = Transformer.#getTemplateLiteral(context, template, "range").split(new RegExp("\\s*,\\s*", "gm")).filter(item => item !== "").map(item =>
					{
						let [lower, upper] = item.trim().split(new RegExp("\\s*-\\s*", "gm")).slice(0, 2).map(i => parseInt(i) || 0);
						if(lower > upper)
							[lower, upper] = [upper, lower];
						if(minimum === undefined || lower < minimum)
							minimum = lower;
						if(maximum === undefined || upper > maximum)
							maximum = upper;

						return({lower, upper});
					});
					let step = parseInt(PathParser.parseValueAttribute(context, template.getAttribute("step"))) || 1;
					let columnCount = parseInt(Transformer.#getTemplateLiteral(context, template, "column-count")) || 0;
					let groupRowCount = parseInt(Transformer.#getTemplateLiteral(context, template, "g-row-count")) || 0;
					let groupRowId = Transformer.#getTemplateLiteral(context, template, "g-row-id");
					let vMap = Transformer.#getTemplateLiteral(context, template, "v-map").split(new RegExp("\\s*,\\s*", "gm")).filter(item => item !== "").map(item =>
					{
						let [range, value] = item.trim().split(new RegExp("\\s*:\\s*", "gm"));
						range = range.split("-");
						if(range.length < 2)
							range[1] = range[0];
						else
							if(range.length > 2)
								range = range.slice(0, 2);
						range = range.map((i, j) => i === "*" || i === "" ? (j === 0 ? minimum : maximum) : parseInt(i) || 0);

						return({start: range[0], stop: range[1], value: value ?? ""});
					});
					let iif = template.getAttribute("if") ?? "";
					let iFormat = template.getAttribute("i-format") ?? "";
					let vFormat = template.getAttribute("v-format") ?? "";
					let xFormat = template.getAttribute("x-format") ?? "";
					let yFormat = template.getAttribute("y-format") ?? "";
					let gFormat = template.getAttribute("g-format") ?? "";
					let y = 0;
					let x = 0;
					let container;
					let groupIndex = -1;
					loop.forEach(loopEntry =>
					{
						for(let index = loopEntry.lower; index <= loopEntry.upper; index += step)
						{
							let v = vMap.find(item => index >= item.start && index <= item.stop)?.value ?? index;
							if(groupRowCount && (y % groupRowCount === 0) && x === 0)
								groupIndex++;
							const replacement =
							{
								"?x?": Transformer.#formatTemplateValue(x, xFormat),
								"?y?": Transformer.#formatTemplateValue(y, yFormat),
								"?i?": Transformer.#formatTemplateValue(index, iFormat),
								"?v?": Transformer.#formatTemplateValue(v, vFormat),
								"?g?": Transformer.#formatTemplateValue(groupIndex, gFormat),
								"?gy?": Transformer.#formatTemplateValue(y - (groupIndex * groupRowCount), yFormat)
							};
							if(groupRowCount && (y % groupRowCount === 0) && x === 0)
							{
								container = template.ownerDocument.createElement("g");
								let id = groupRowId;
								Object.entries(replacement).forEach(([replaceKey, replaceValue]) =>
									id = id.replaceAll(replaceKey, replaceValue)
								);
								container.setAttribute("id", id);
								template.parentNode.insertBefore(container, template);
							}
							Transformer.#insertTemplateContent(template, replacement, iif, context, container);
							x++;
							if(x === columnCount)
							{
								x = 0;
								y++;
							}
						}

						return;
					});
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

		return (list.filter(i => i.hasAttribute("id")).map(i =>
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
			literal: {},
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
		Transformer.#parseMeta(this.document);
		Transformer.#parseUnitList(context, Array.from(this.document.getElementsByTagName("unit")));
		Transformer.#parseLiteralList(context, Array.from(this.document.getElementsByTagName("literal")));
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
			item.setAttribute("d", PathParser.resultToString(pathResult, context.optimisation.path.precision));
		}
		const scan =
		[
			{tagName: "svg", attribute: [{name: "viewBox", limit: 4}, "width", "height"]},
			{tagName: "rect", attribute: ["x", "y", "width", "height", "rx", "ry"]},
			{tagName: "text", attribute: ["x", "y"]},
			{tagName: "use", attribute: ["x", "y"]},
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

					if(typeof(attribute) === "string")
					{
						attributeName = attribute;
					}
					else
					{
						attributeName = attribute.name;
					}
					if(item.hasAttribute(attributeName))
						item.setAttribute(attributeName, PathParser.parseValueAttribute(context, item.getAttribute(attributeName)));

					return;
				});
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
}

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
	const fs = require('fs');
	const path = require('path');
	let parameterList;
	let comseq = process.argv[2];
	let comseqfound = false;
	if(fs.existsSync(comseq) && fs.lstatSync(comseq).isDirectory())
	{
		process.chdir(comseq);
		comseq = path.join(comseq, "comseq.txt");
		parameterList = fs.readFileSync(comseq, "utf-8").split("\n").map(line => line.trim()).map(line => line.split(new RegExp("\\s+")));
		comseqfound = true;
	}
	else
		parameterList = [process.argv.slice(2)];
	parameterList.forEach((parameter, pindex) =>
	{
		if(comseqfound)
			console.log(`Command ${pindex + 1} of ${parameterList.length}`, "[\"" + parameter.join("\", \"") + "\"]");
		let timeStart = Date.now();
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
				case "--report":
					configuration.report = true;
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
	--report                          Report information before and after processing a file
units        Variable values to be passed to the Pather environment
             Name/value pairs separated by "=", e.g. myUnit=3 myOtherUnit=4.2
`
				);
		}
		else
		{
			let source = parameter.shift();
			configuration.destination = parameter.shift();
			if(configuration.report)
				console.log(`Processing "${source}"...`);
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
				configuration.base = path.dirname(source) + path.sep;
				const data = fs.readFileSync(source, {encoding: "utf-8", flag: "r"});
				let t = new Transformer(data);
				let output = t.transform(configuration);
				output.forEach(([i, j]) =>
				{
					if(!fs.existsSync(path.dirname(i)))
						fs.mkdirSync(path.dirname(i), { recursive: true });
					fs.writeFileSync(i, j, {encoding: "utf-8"});
	
					return;
				});
				if(configuration.report)
					console.log(`Completed successfully in ${Date.now() - timeStart} ms\n`);
			}
		}

		return;
	});

	return;
})();
//# sourceMappingURL=main.js.map
