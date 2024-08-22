// MIT License: https://github.com/NoHomey/bind-decorator/blob/master/License
// Copyright (c) 2016 Ivo Stratev

/**
 * `@bind` is a decorator that binds the method to the instance of the class (legacy stage-2
 * typescript decorators).
 *
 * @public
 */
export function bind<T extends (...args: any[]) => any>(
	target: object,
	propertyKey: string,
	descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T>

/**
 * `@bind` is a decorator that binds the method to the instance of the class (TC39 decorators).
 *
 * @public
 */
export function bind<This extends object, T extends (...args: any[]) => any>(
	originalMethod: T,
	context: ClassMethodDecoratorContext<This, T>
): void

/** @public */
export function bind(
	...args: // legacy stage-2 typescript decorators
	| [_target: object, propertyKey: string, descriptor: PropertyDescriptor]
		// TC39 decorators
		| [originalMethod: (...args: any[]) => any, context: ClassMemberDecoratorContext]
): PropertyDescriptor | void {
	if (args.length === 2) {
		const [_originalMethod, context] = args
		const methodName = context.name
		if (context.private) {
			throw new Error(`'bind' cannot decorate private properties like ${methodName as string}.`)
		}
		context.addInitializer(function (this: any) {
			this[methodName] = this[methodName].bind(this)
		})
	} else {
		const [_target, propertyKey, descriptor] = args
		if (!descriptor || typeof descriptor.value !== 'function') {
			throw new TypeError(
				`Only methods can be decorated with @bind. <${propertyKey}> is not a method!`
			)
		}

		return {
			configurable: true,
			get(this: any): any {
				const bound = descriptor.value!.bind(this)
				// Credits to https://github.com/andreypopp/autobind-decorator for memoizing the result of bind against a symbol on the instance.
				Object.defineProperty(this, propertyKey, {
					value: bound,
					configurable: true,
					writable: true,
				})
				return bound
			},
		}
	}
}
