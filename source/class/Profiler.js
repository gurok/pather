export default class Profiler
{
	static #stack = [];
	static #tally = {};

	static disable()
	{
		Profiler.begin = () => {};
		Profiler.end = (rv) => rv;
	}

	static begin(name)
	{
		Profiler.#stack.push([name, performance.now()]);

		return;
	}

	static end(returnValue)
	{
		const now = performance.now();
		/*
		const nameList = Profiler.#stack.map(([name]) => name);
		const uniqueNameList = Array.from(new Set(nameList));
		//  + (nameList.length !== uniqueNameList.length ? " (!)" : "");
		const name = uniqueNameList.join(" >> ");
		*/
		const name = Profiler.#stack[Profiler.#stack.length - 1][0];
		if(!(name in Profiler.#tally))
			Profiler.#tally[name] = [0, 0];
		Profiler.#tally[name][0] += now - Profiler.#stack[Profiler.#stack.length - 1][1];
		Profiler.#tally[name][1]++;
		Profiler.#stack.pop();
		if(!Profiler.#stack.length)
			Profiler.report();

		return(returnValue);
	}

	static report()
	{
		console.log("Report\n======");
		console.log(
			Object.entries(this.#tally)
			.sort(([, [valueA]], [, [valueB]]) => valueA < valueB ? -1 : (valueA > valueB ? 1 : 0))
			.map(([key, [duration, count]]) => `${Math.ceil(duration).toString().padStart(7)} ${count.toString().padStart(7)} ${Math.ceil(duration * 100 / count).toString().padStart(7)} ${key}`)
			.join("\n")
		);

		return;
	}
};

// return Profile.of(name, () => {
// })
