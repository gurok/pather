# PATHER: Reuse SVG

Pather is an SVG preprocessor that allows you to:

- Perform basic arithmetic inside paths (`+`,`-`,`/`,`*`)
- Define custom units
- Reuse, rotate and measure paths

## Units

Pather introduces a `<unit>` tag. Units can be used in path data (`d`) and `viewBox` attributes. They greatly simplify working with scaled values and offer great flexibility:

````
<unit id="g" value="50" /> <!-- One grid unit -->
<path d="M 1g,1g l 5g,0 l 0,5g z" />
````

becomes:

```
 <!-- One grid unit -->
<path d="M 50,50 l 250,0 l 0,250 z" />
```

## Segments

Segments define common path data to be reused. You can call a segment simply by specifying its name:

```
<segment id="bumpyLine" d="h 50 l 5,-5 l 5,10 l 5,-5 h 50" />
<path d="M 100,100 bumpyLine bumpyLine" />
```

becomes:

```
<path d="M 100,100 h 50 l 5,-5 l 5,10 l 5,-5 h 50 h 50 l 5,-5 l 5,10 l 5,-5 h 50" />
```

## Expressions

In path data, any sequence of operators and numbers/units without whitespace is interpreted as an expression. In addition, you can wrap an expression in brackets and use spacing freely:

```
<path d="M 30*5,(20 + 1) l 50,0 z" />
```

becomes:

```
<path d="M 150,21 l 50,0 z" />
```

Unit definitions can also be expressions:

```
<unit id="halfG" value="g / 2" />
```

Valid operators are `+`, `-`, `*` and `/`. When a number is directly followed by a unit (e.g. `3g`), there is an implicit multiply (`3*g`). Expressions always produce a single value — commas are not allowed.

Gotcha: Be careful with unenclosed expressions like `3n-1`. Due to the nature of path data parsing, the `-` means this expression must be parsed as two values, `3n` and `-1`, regardless of whitespace. To avoid this, wrap expressions using the `-` operator in brackets, `(3n - 1)`.

## Advanced Segments

You can call a segment multiple times by prefixing it with a number:

```
<segment id="bumpyLine" d="h 50 l 5,-5 l 5,10 l 5,-5 h 50" />
<path d="M 100,100 2bumpyLine" />
```

becomes:

```
<path d="M 100,100 h 50 l 5,-5 l 5,10 l 5,-5 h 50 h 50 l 5,-5 l 5,10 l 5,-5 h 50" />
```

You can also rotate a segment using the distortion operator:

```
<path d="M 100,100 bumpyLine%r45" />
```

There are four available distortions:
 - `%r`*`N`* Rotates a segment by `N` degrees
 - `%h`*`N`* Skews a segment horizontally by `N` degrees
 - `%v`*`N`* Skews a segment vertically by `N` degrees
 - `%o` Reverses the order of commands in a segment

You can call a segment with named parameters that override unit values:

```
<path d="M 100,100 bumpyLine(g=20 %r=45 #=3)"
```

Where `%r=` and `#=` are alternate syntax for distortion operators and repetition respectively.

You can also measure a segment's width/height and use it as a value:

```
<!-- Draw a line that's the width and height of a bumpyLine -->
<path d="M 100,100 l |bumpyLine|,|bumpyLine|" />
```

Units and segments can have any alphanumeric name that doesn't collide with an SVG command (`a`,`c`,`h`,`l`,`m`,`q`,`s`,`t`,`v`,`z`).

The `@` operator can be used to make a single value in a command absolute (fixed), e.g.

```
<!-- Draw a line 50 down, to point 30 exactly on the canvas. -->
<path d="M 100,100 l 50,@30" />
```

A fixed value also does not respond to rotation.

## Includes

You can include an external file using:

```
<include href="path/to/file" />
```

Or a specific element by ID with:

```
<include href="path/to/file#id" />
```

## Using Pather

Firstly, install prerequisite packages:

```
npm install
```

Build Pather with the following:

```
npm run build
```

Then launch it  with:

```
 npm --silent start -- "input.svg" "output.svg"
```

More help and command line options are available by launching pather with no parameters:

```
npm --silent start --
```

Building Pather will also give you a plain Javascript file (`build/pather.min.js`), which may or may not be usable in a browser with a little tweaking.