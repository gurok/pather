import Token from "./Token";
import BigDecimal from "./BigDecimal";
import Value from "./Value";

export default class TokenStream
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
};
