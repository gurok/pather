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
			x: new BigDecimal(0),
			y: new BigDecimal(0),
			fixNext: false,
			lastAngle: null,
			originX: new BigDecimal(0),
			originY: new BigDecimal(0) 
		});
	}
};
