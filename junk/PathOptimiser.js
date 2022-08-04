//useShorthand: true, /* Need to do a pass for t and s, don't emit duplicate commands if unnecessary */


if(context.optimisation.path.useShorthand && result.sequence.length > 0)
{
	let lcIndex = result.sequence.length - 1;
	let lastCommand = result.sequence[lcIndex];
	let refCommand;
	let lcControlX;
	let lcControlY;
	let lcTargetX;
	let lcTargetY;
	let tControlX;
	let tControlY;
	let tTargetX;
	let tTargetY;
	switch(lastCommand[0])
	{
		case "T":
			while(lcIndex > 0 && result.sequence[lcIndex][0] === "T")
				lcIndex--;
			lastCommand = result.sequence[lcIndex];
			if(lastCommand[0] !== "Q")
			{
				result.sequence.push(top);
				break;
			}

			console.log("T found", lastCommand);
		case "Q":
			if(top[0] === "Q" && lastCommand.length > 4 && top.length === 5)
			{
				lcControlX = lastCommand[lastCommand.length - 4];
				lcControlY = lastCommand[lastCommand.length - 3];
				lcTargetX = lastCommand[lastCommand.length - 2];
				lcTargetY = lastCommand[lastCommand.length - 1];
				tControlX = top[top.length - 4];
				tControlY = top[top.length - 3];
				if(lcControlX.subtract(lcTargetX).equals(lcTargetX.subtract(tControlX)) && lcControlY.subtract(lcTargetY).equals(lcTargetY.subtract(tControlY)))
					top = ["T", ...top.slice(3)];
				result.sequence.push(top);
			}
			else
				result.sequence.push(top);
			break;
		default:
			if(lastCommand[0] === top[0])
				lastCommand.push(...top.slice(1));
			else
				result.sequence.push(top);
			break;
	}
}
