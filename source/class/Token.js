export default class Token
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
    static TYPE_OPERATOR_FIX              = 15;
    static TYPE_OPERATOR_MEASURE          = 16;
    static TYPE_OPERATOR_ASSIGN           = 17;
    static TYPE_OPERATOR_REPEAT           = 18;

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
};
