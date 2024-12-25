import BigDecimal from "./BigDecimal";

export default class Distortion
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
			default:
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
			x: relative ? BigDecimal.ZERO : result.x,
			y: relative ? BigDecimal.ZERO : result.y
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
				let topX = command === "v" ? {value: origin.x, fixed: top[1].fixed} : top[1];
				let topY = command === "h" ? {value: origin.y, fixed: top[1].fixed} : (command === "v" ? top[1] : top[2]);
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
				}
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
				result.x = result.originX;
				result.y = result.originY;
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
			result.originX = result.x;
			result.originY = result.y;
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
