'use client'

import { Button } from '@/components/common/button'
import { cn } from '@/utils/cn'
import { Field, Input, Label } from '@headlessui/react'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { getFromLocalStorage, setInLocalStorage } from '@tldraw/utils'
import { FC, FormEventHandler, useCallback, useLayoutEffect, useState } from 'react'

// when debugging is true, the form will always show (even if the user has submitted)
const DEBUGGING = true

export const NewsletterSignup: FC<{ size?: 'small' | 'large' }> = ({ size = 'large' }) => {
	// If the user has submitted their email, we don't show the form anymore
	const [didSubmit, setDidSubmit] = useLocalStorageState('dev_did_submit_newsletter', false)

	// Todo: replace with react query or something to handle the async work
	const [formState, setFormState] = useState<'idle' | 'success' | 'error'>('idle')

	const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
		(e) => {
			if (formState !== 'idle') return

			e.preventDefault()
			try {
				const _email = new FormData(e.currentTarget)?.get('email') as string
				// todo: submit email to backend...
				setFormState('success')
				// After a pause, we locally save that the user has submitted the form
				setTimeout(() => {
					setDidSubmit(true)
					setTimeout(() => setFormState('idle'), 3000)
				}, 3000)
			} catch (e) {
				setFormState('error')
				// After a pause, we set the form state to idle
				setTimeout(() => setFormState('idle'), 3000)
			}
		},
		[setDidSubmit, formState]
	)

	// If the user has already submitted the form, we don't show it anymore,
	// unless we're both in development mode AND the debug flag is enabled.
	if (didSubmit && !(DEBUGGING && process.env.NODE_ENV === 'development')) return null

	return (
		<div
			className={cn(
				'bg-zinc-50',
				size === 'small'
					? 'mt-12 rounded-lg text-xs xl:-ml-4 p-4 pb-1'
					: 'rounded-xl p-8 sm:p-12 text-center'
			)}
		>
			<h3
				className={cn(
					'text-black',
					size === 'small'
						? 'text-base leading-tight mb-2 font-semibold'
						: 'text-2xl mb-3 font-bold'
				)}
			>
				Subscribe to our Newsletter
			</h3>
			<p className={cn(size === 'small' ? 'mb-4' : 'mb-8 text-zinc-800')}>
				Team news, product updates and deep dives from the team.
			</p>
			<form
				onSubmit={handleSubmit}
				className={cn(
					'pb-3',
					size === 'large' &&
						'flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2'
				)}
			>
				<Field className={cn(size === 'large' && 'grow sm:max-w-xs')}>
					<Label htmlFor="email" className="sr-only">
						Email-Address
					</Label>
					<Input
						name="email"
						type="email"
						placeholder="Your Email-Address"
						className={cn(
							'resize-none bg-zinc-200/50 w-full rounded-md placeholder-zinc-400 text-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-zinc-50',
							size === 'small' ? 'h-6 px-2' : 'text-base h-9 px-3'
						)}
						required
					/>
				</Field>
				<Button
					submit
					caption="Submit"
					arrow="right"
					size={size === 'small' ? 'xs' : 'base'}
					className={cn('justify-center', size === 'small' && 'w-full mt-2')}
				/>
			</form>
			{formState === 'idle' && size === 'large' && (
				<p className="mb-3 text-sm">Join 1,000+ subscribers</p>
			)}
			{formState === 'success' && (
				<p
					className={cn(
						'flex items-center gap-1.5 mb-3',
						size === 'large' && 'text-sm justify-center'
					)}
				>
					<CheckCircleIcon className="h-4 text-emerald-500" />
					<span>Thanks for subscribing! 👋</span>
				</p>
			)}
			{formState === 'error' && (
				<p
					className={cn(
						'flex items-center gap-1.5 mb-3',
						size === 'large' && 'text-sm justify-center'
					)}
				>
					<ExclamationCircleIcon className="h-4 text-rose-500" />
					<span>Something went wrong.</span>
				</p>
			)}
		</div>
	)
}

/** @public */
export function useLocalStorageState<T = any>(key: string, defaultValue: T) {
	const [state, setState] = useState(defaultValue)

	useLayoutEffect(() => {
		const value = getFromLocalStorage(key)
		if (value) {
			try {
				setState(JSON.parse(value))
			} catch (e) {
				console.error(`Could not restore value ${key} from local storage.`)
			}
		}
	}, [key])

	const updateValue = useCallback(
		(setter: T | ((value: T) => T)) => {
			setState((s) => {
				const value = typeof setter === 'function' ? (setter as any)(s) : setter
				setInLocalStorage(key, JSON.stringify(value))
				return value
			})
		},
		[key]
	)

	return [state, updateValue] as const
}
