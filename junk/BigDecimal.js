export default class BigDecimal
{
    static #LIMIT_PRECISION        = 18;
    static #LIMIT_ORDER            = 8;
    static #VALUE_SHIFT            = BigInt("1" + "0".repeat(BigDecimal.#LIMIT_PRECISION));
    static #PATTERN_TRAILING_ZERO  = new RegExp("\\.?0+$");

    static PI   = new BigDecimal(0).#fromBigInt(3141592653589793238n);
    static TAU  = new BigDecimal(0).#fromBigInt(6283185307179586477n);

    #value;

    constructor(source)
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
                this.#value = BigInt(integerPart + decimalPart.substr(0, BigDecimal.#LIMIT_PRECISION).padEnd(BigDecimal.#LIMIT_PRECISION, "0"));
                if(decimalPart.charCodeAt(BigDecimal.#LIMIT_PRECISION) > 52)
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

    #factorialAsBigInt(count)
    {
        let result;

        result = BigInt(count);
        while(count > 2n)
            result *= BigInt(--count);

        return(result);
    }

    #taylorSeries(offset, initialValue)
    {
        let result;
        let index;
        let step;

        result = initialValue;
        index = BigDecimal.#LIMIT_ORDER;
        while(index--)
        {
            step = offset + (index * 2);
            result = result[index % 2 ? "add" : "subtract"](this.raiseTo(step).divideBy(this.#factorialAsBigInt(step)));
        }

        return(result);
    }

    sine()
    {
        let angle;

        angle = this.modulo(BigDecimal.TAU);

        return(angle.#taylorSeries(3, angle));
    }

    cosine()
    {
        let angle;

        angle = this.modulo(BigDecimal.TAU);

        return(angle.#taylorSeries(2, new BigDecimal(1)));
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

    modulo(other)
    {
        other = new BigDecimal(other).#value;

        return(this.#fromBigInt(((this.#value % other) + other) % other));
    }

    raiseTo(power)
    {
        return(this.#fromBigIntDivision(this.#value ** BigInt(power), BigDecimal.#VALUE_SHIFT ** BigInt(power - 1)));
    }

    valueOf()
    {
        return(this.#value);
    }

    toString(precision = BigDecimal.#LIMIT_PRECISION)
    {
        let text;

        text = this.#fromBigIntDivision(this.#value, BigInt("1" + "0".repeat(precision > -1 ? Math.max(BigDecimal.#LIMIT_PRECISION - precision, 0) : BigDecimal.#LIMIT_PRECISION))).#value.toString().padStart(precision + 1, "0");

        return(text.substr(0, text.length - precision) + ("." + text.substr(-precision)).replace(BigDecimal.#PATTERN_TRAILING_ZERO, ""));
    }
}
