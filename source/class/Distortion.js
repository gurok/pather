import BigDecimal from "./BigDecimal";

export default class Distortion
{
	static OPERATION_NONE = 0;
	static OPERATION_ROTATE = 1;
	static OPERATION_SKEW_HORIZONTAL = 2;
	static OPERATION_SKEW_VERTICAL = 3;

	static #rotate(x0, y0, x1, y1, distortionValue)
	{
		var cosine;
		var sine;

		x1 = x1.subtract(x0);
		y1 = y1.subtract(y0);
		distortionValue = (distortionValue.toNumber() % 360) * Math.PI / 180;
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
	
		return(
		{
			x: x0.add(x1.multiplyBy(cosine)).subtract(y1.multiplyBy(sine)),
			y: y0.add(y1.multiplyBy(cosine)).add(x1.multiplyBy(sine))
		});
	}
	
	static #skewX(x0, y0, x1, y1, distortionValue)
	{
		return(
		{
			x: x0.add(x1.subtract(x0).subtract(y1.multiplyBy(Math.tan((distortionValue.toNumber() % 360) * Math.PI / 180)))),
			y: y1
		});
	}

	static #skewY(x0, y0, x1, y1, distortionValue)
	{
		return(
		{
			x: x1,
			y: y0.add(y1.subtract(y0).subtract(x1.multiplyBy(Math.tan((distortionValue.toNumber() % 360) * Math.PI / 180))))
		});
	}

	static #fixPoint(point, relative, topX, topY, distortionType, result)
	{
		if(distortionType === Distortion.OPERATION_SKEW_VERTICAL)
			point.x = topX.value;
		else
			if(topX.fixed)
				point.x = relative ? topX.value.subtract(result.x) : topX.value;
		if(distortionType === Distortion.OPERATION_SKEW_HORIZONTAL)
			point.y = topY.value;
		else
			if(topY.fixed)
				point.y = relative ? topY.value.subtract(result.y) : topY.value;

		return;
	}

	static applyDistortion(context, top, result, distortionType, distortionValue)
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
		const distortionFunction =
		({
			[Distortion.OPERATION_ROTATE]: this.#rotate,
			[Distortion.OPERATION_SKEW_HORIZONTAL]: this.#skewX,
			[Distortion.OPERATION_SKEW_VERTICAL]: this.#skewY
		})[distortionType] || this.#rotate;
		// TODO: Eventually, all values will need to be rounded just beyond this point
		switch(command)
		{
			case "a":
				point =
				{
					x: top[6].value,
					y: top[7].value
				};
				if(distortionType !== Distortion.OPERATION_NONE)
					point = distortionFunction(origin.x, origin.y, point.x, point.y, distortionValue);
				Distortion.#fixPoint(point, relative, top[6], top[7], distortionType, result);
				top =
				[
					top[0],
					top[1].value,
					top[2].value,
					top[3].fixed ? top[3].value : top[3].value.add(distortionValue),
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
				if(distortionType !== Distortion.OPERATION_NONE)
				{
					point1 = distortionFunction(origin.x, origin.y, point1.x, point1.y, distortionValue);
					point2 = distortionFunction(origin.x, origin.y, point2.x, point2.y, distortionValue);
					point = distortionFunction(origin.x, origin.y, point.x, point.y, distortionValue);
				}
				Distortion.#fixPoint(point, relative, top[5], top[6], distortionType, result);
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
				if(distortionType !== Distortion.OPERATION_NONE)
				{
					point1 = distortionFunction(origin.x, origin.y, point1.x, point1.y, distortionValue);
					point = distortionFunction(origin.x, origin.y, point.x, point.y, distortionValue);
				}
				Distortion.#fixPoint(point, relative, top[3], top[4], distortionType, result);
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
				if(distortionType !== Distortion.OPERATION_NONE)
					point = distortionFunction(origin.x, origin.y, point.x, point.y, distortionValue);
				lastAngle = Math.atan2(point.y.subtract(origin.y).toNumber(), point.x.subtract(origin.x).toNumber()) * 180 / Math.PI;
				Distortion.#fixPoint(point, relative, topX, topY, distortionType, result);
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
				if(distortionType !== Distortion.OPERATION_NONE)
					point = distortionFunction(origin.x, origin.y, point.x, point.y, distortionValue);
				Distortion.#fixPoint(point, relative, top[1], top[2], distortionType, result);
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
}
