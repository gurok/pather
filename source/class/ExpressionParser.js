import TokenStream from "./TokenStream";
import Token from "./Token";
import BigDecimal from "./BigDecimal";
import Value from "./Value";
import PathParser from "./PathParser";
import Distortion from "./Distortion";

export default class ExpressionParser
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
		return(operation.value + " " + ["", "=", "+", "-", "*", "/"][operation.operation]);
	}

    static #unwind(result, limit)
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
					ExpressionParser.#unwind(result, ExpressionParser.#OPERATION_SUBTRACT);
					result.stack.push({operation: ExpressionParser.#OPERATION_SUBTRACT, value: result.accumulator});
					result.data = Token.TYPE_OPERATOR_SUBTRACT;
					break;
				case Token.TYPE_OPERATOR_ADD:
					if(result.data !== Token.TYPE_NUMBER && result.data !== Token.TYPE_WHITESPACE)
						throw(new SyntaxError(`Unexpected token "${state.current.name}" at column ${state.current.position}`));
					if(this.debug)
						console.log("+", state.current);
					ExpressionParser.#unwind(result, ExpressionParser.#OPERATION_SUBTRACT);
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
					new ExpressionParser(this.stream).parseInvocation(context, expResult, argumentList);
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
						ExpressionParser.#unwind(result, ExpressionParser.#OPERATION_EVALUATE);
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
		ExpressionParser.#unwind(result, ExpressionParser.#OPERATION_SUBTRACT);
		ExpressionParser.#unwind(result, 0);

		return(result);
	}

	parseInvocation(context, result, argumentList)
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
			distortionValue: new BigDecimal(0),
			distorationType: Distortion.OPERATION_NONE,
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
			const segmentName = name;
			state.current = this.stream.getNext();
			while(state.reading === true && state.current)
			{
				switch(state.current.type)
				{
					case Token.TYPE_OPERATOR_ROTATE:
					case Token.TYPE_OPERATOR_SKEW_HORIZONTAL:
					case Token.TYPE_OPERATOR_SKEW_VERTICAL:
						if(state.distorationType !== Distortion.OPERATION_NONE)
							throw(new Error(`Encountered distortion operator, but distortion for segment "${name}" is already specified (parameter value: ${state.distortionValue})`));
						this.stream.getNext();
						expResult = new ExpressionParser(this.stream).parse(context, 0, argumentList, false, {x: result.x, y: result.y}, Value.TYPE_THETA, [Token.TYPE_OPERATOR_ROTATE, Token.TYPE_OPERATOR_SKEW_HORIZONTAL, Token.TYPE_OPERATOR_SKEW_VERTICAL]);
						state.distortionValue = expResult.accumulator;
						state.distorationType =
						({
							[Token.TYPE_OPERATOR_ROTATE]: Distortion.OPERATION_ROTATE,
							[Token.TYPE_OPERATOR_SKEW_HORIZONTAL]: Distortion.OPERATION_SKEW_HORIZONTAL,
							[Token.TYPE_OPERATOR_SKEW_VERTICAL]: Distortion.OPERATION_SKEW_VERTICAL
						})[state.current.type];
						state.current = this.stream.getCurrent();
						continue;
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
												case Token.TYPE_OPERATOR_ROTATE:
												case Token.TYPE_OPERATOR_SKEW_HORIZONTAL:
												case Token.TYPE_OPERATOR_SKEW_VERTICAL:
													if(state.distorationType !== Distortion.OPERATION_NONE)
														throw(new Error(`Encountered distortion operator, but distortion for segment "${segmentName}" is already specified (parameter value: ${state.distortionValue})`));
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
													state.distortionValue = expResult.accumulator;
													state.distorationType = ({
														[Token.TYPE_OPERATOR_ROTATE]: Distortion.OPERATION_ROTATE,
														[Token.TYPE_OPERATOR_SKEW_HORIZONTAL]: Distortion.OPERATION_SKEW_HORIZONTAL,
														[Token.TYPE_OPERATOR_SKEW_VERTICAL]: Distortion.OPERATION_SKEW_VERTICAL
													})[type];
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
				inner.parse(context, result, state.distorationType, state.distortionValue, index, state.argumentList);
				result.stack.pop();
			}
			state.reading = false;
		}
		else
			throw(new ReferenceError(`Segment ${state.current.name} cannot call itself`));
	
		return;
	}
}
