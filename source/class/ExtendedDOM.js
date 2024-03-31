export default class ExtendedDOM
{
	static typeof(node)
	{
		return(node && node.constructor ? node.constructor.name.toLowerCase() : undefined);
	}

	static extractChildren(element, clean = true)
	{
		if(clean && ExtendedDOM.typeof(element.firstChild) === "text")
			element.removeChild(element.firstChild);
		while(element.firstChild)
			element.parentNode.insertBefore(element.firstChild, element);
		element.parentNode.removeChild(element);

		return;
	}

	static remove(element, clean = true)
	{
		if(clean && ExtendedDOM.typeof(element.previousSibling) === "text")
			element.parentNode.removeChild(element.previousSibling);
		element.parentNode.removeChild(element);

		return;
	}
}
