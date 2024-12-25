export default class BigDecimal
{
    static LIMIT_PRECISION         = 18;
    static PI                      = new BigDecimal("3.141592653589793238");
    static ZERO                    = new BigDecimal("0");
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
                this.#value = value * BigDecimal.#VALUE_SHIFT;
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
