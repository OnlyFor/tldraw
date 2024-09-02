import { TLShapeId } from '@tldraw/tlschema'
import { assert } from '@tldraw/utils'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Editor } from '../editor/Editor'
import { TLSvgOptions } from '../editor/types/misc-types'
import { getSvgJsx } from './getSvgJsx'
import { StyleEmbedder } from './html-to-image/StyleEmbedder'
import { embedMedia } from './html-to-image/embedMedia'

export async function exportToSvg(editor: Editor, shapeIds: TLShapeId[], opts: TLSvgOptions = {}) {
	const result = await getSvgJsx(editor, shapeIds, opts)
	if (!result) return undefined

	const container = editor.getContainer()
	// container.querySelectorAll('.tldraw-svg-export').forEach((el) => el.remove())
	const renderTarget = document.createElement('div')
	renderTarget.className = 'tldraw-svg-export'
	renderTarget.inert = true
	renderTarget.tabIndex = -1
	Object.assign(renderTarget.style, {
		position: 'absolute',
		top: '0px',
		left: '0px',
		width: result.width + 'px',
		height: result.height + 'px',
		pointerEvents: 'none',
		opacity: 0,
	})
	container.appendChild(renderTarget)
	const root = createRoot(renderTarget)

	try {
		flushSync(() => {
			root.render(result.jsx)
		})

		await waitForPromisesToResolve(result.waitForPromises)

		const svg = renderTarget.firstElementChild
		assert(svg instanceof SVGSVGElement, 'Expected an SVG element')
		await applyChangesToForeignObjects(svg)

		return { svg, width: result.width, height: result.height }
	} finally {
		root.unmount()
		container.removeChild(renderTarget)
	}
}

async function applyChangesToForeignObjects(svg: SVGSVGElement) {
	const foreignObjectChildren = [
		...svg.querySelectorAll('foreignObject.tl-shape-foreign-object > *'),
	]
	if (!foreignObjectChildren.length) return

	const styleEmbedder = new StyleEmbedder(svg)

	await Promise.all(foreignObjectChildren.map((el) => embedMedia(el as HTMLElement)))
	for (const el of foreignObjectChildren) {
		styleEmbedder.read(el as HTMLElement)
	}

	await styleEmbedder.fetchResources()
	const css = await styleEmbedder.embedStyles()

	if (css) {
		const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
		style.textContent = css
		svg.prepend(style)
	}
}

async function waitForPromisesToResolve(promises: Promise<void>[]) {
	let lastLength = null
	while (lastLength !== promises.length) {
		lastLength = promises.length
		await Promise.all(promises)
		// eslint-disable-next-line no-restricted-globals
		await new Promise((r) => setTimeout(r, 0))
	}
}
