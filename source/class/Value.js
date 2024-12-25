import BigDecimal from "./BigDecimal";

export default class Value
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
			x: BigDecimal.ZERO,
			y: BigDecimal.ZERO,
			fixNext: false,
			lastAngle: null,
			originX: BigDecimal.ZERO,
			originY: BigDecimal.ZERO
		});
	}
};
