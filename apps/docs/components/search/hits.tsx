import { SearchEntry } from '@/utils/algolia'
import { Command } from 'cmdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useRef } from 'react'
import { Highlight, useHits } from 'react-instantsearch'

export function Hits({ onClose }: { onClose(): void }) {
	const { items, results } = useHits<SearchEntry>()
	const query = results?.query
	const router = useRouter()
	const listRef = useRef<HTMLDivElement>(null)
	let section = ''

	const onSelect = (path: string) => {
		router.push(path)
		onClose()
	}

	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTop = 0
		}
	}, [query])

	return (
		<Command.List
			ref={listRef}
			className="max-h-[32rem] overflow-y-auto p-4 pt-0 border-t border-zinc-100 dark:border-zinc-800"
		>
			<Command.Empty className="text-center py-8 text-zinc-400 dark:text-zinc-600">
				Nothing found…
			</Command.Empty>
			{items.map((hit) => {
				const showChapter = hit.section !== section
				section = hit.section

				const href = hit.headingSlug ? `${hit.path}#${hit.headingSlug}` : hit.path

				return (
					<Fragment key={hit.objectID}>
						{showChapter && (
							<div className="text-black dark:text-white font-semibold mt-6 mb-4">{section}</div>
						)}
						<Command.Item value={href} onSelect={onSelect} className="group">
							<Link
								href={href}
								className="block px-4 pt-2.5 pb-3 bg-zinc-100 dark:bg-zinc-800 mt-2 rounded-md cursor-pointer group-data-[selected=true]:bg-blue-500 dark:group-data-[selected=true]:bg-blue-500 group-data-[selected=true]:text-blue-200 [&_mark]:bg-transparent [&_mark]:font-bold [&_mark]:text-white"
							>
								<Highlight
									attribute="title"
									hit={hit}
									className="text-black dark:text-white group-data-[selected=true]:text-white"
								/>
								{/* <FocusedHighlight hit={hit} attribute="description" />
								<FocusedHighlight hit={hit} attribute="content" /> */}
								<Highlight attribute="description" hit={hit} className="line-clamp-1 text-sm" />
								<Highlight attribute="content" hit={hit} className="line-clamp-1 text-sm" />
							</Link>
						</Command.Item>
					</Fragment>
				)
			})}
		</Command.List>
	)
}

// function FocusedHighlight({
// 	hit,
// 	attribute,
// }: {
// 	hit: Hit<SearchEntry>
// 	attribute: keyof SearchEntry
// }) {
// 	const property = getPropertyByPath(hit._highlightResult, attribute as string) || []
// 	const properties = Array.isArray(property) ? property : [property]

// 	const parts = properties.map((singleValue) =>
// 		getHighlightedParts(unescape(singleValue.value || ''))
// 	)
// 	console.log(parts)
// 	return <></>
// }

// function getHighlights(
// 	hit: Hit<SearchEntry>,
// 	attribute: keyof SearchEntry,
// 	maxUnhighlightedPrefix: number
// ): { didMatch: boolean; parts: { value: string; isHighlighted: boolean }[] } {
// 	const property = getPropertyByPath(hit._highlightResult, attribute as string)

// 	const parts = getHighlightedParts(unescape(property.value || ''))

// 	if (parts.length === 0) {
// 		return []
// 	}

// 	return parts
// }
