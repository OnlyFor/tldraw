export function assert(thing: unknown, errorMessage?: string): asserts thing {
	if (!thing) {
		throw new Error(errorMessage ?? 'assertion failed')
	}
}
