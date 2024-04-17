import {
	Box,
	ComputedCache,
	EMPTY_ARRAY,
	Editor,
	Mat,
	TLShape,
	Vec,
	atom,
	clamp,
	computed,
	react,
	uniqueId,
} from '@tldraw/editor'
import { getRgba } from './getRgba'
import { BufferStuff, appendVertices, setupWebGl } from './minimap-webgl-setup'
import { pie, roundedRectangle } from './minimap-webgl-shapes'

export class MinimapManager {
	disposables = [] as (() => void)[]
	close = () => this.disposables.forEach((d) => d())
	gl: ReturnType<typeof setupWebGl>
	geometryCache: ComputedCache<Float32Array, TLShape>
	constructor(
		public editor: Editor,
		public readonly elem: HTMLCanvasElement
	) {
		this.gl = setupWebGl(elem)
		this.geometryCache = editor.store.createComputedCache('webgl-geometry', (r: TLShape) => {
			const pageTransform = editor.getShapePageTransform(r.id)
			const geometry = editor.getShapeGeometry(r.id).getWebGLGeometry()
			const transformedGeometry = new Float32Array(geometry.values.length)
			for (let i = 0; i < transformedGeometry.length; i += 2) {
				;[transformedGeometry[i], transformedGeometry[i + 1]] = Mat.applyToXY(
					pageTransform,
					geometry.values[i],
					geometry.values[i + 1]
				)
			}
			return transformedGeometry
		})

		this.colors = this._getColors()
		this.disposables.push(this._listenForCanvasResize(), react('minimap render', this.render))
	}

	private _getColors() {
		const style = getComputedStyle(this.editor.getContainer())

		return {
			shapeFill: getRgba(style.getPropertyValue('--color-text-3').trim()),
			selectFill: getRgba(style.getPropertyValue('--color-selected').trim()),
			viewportFill: getRgba(style.getPropertyValue('--color-muted-1').trim()),
		}
	}

	private colors: ReturnType<MinimapManager['_getColors']>
	// this should be called after dark/light mode changes have propagated to the dom
	updateColors() {
		this.colors = this._getColors()
	}

	readonly id = uniqueId()
	@computed
	getDpr() {
		return this.editor.getInstanceState().devicePixelRatio
	}

	@computed
	getCollaboratorsQuery() {
		return this.editor.store.query.records('instance_presence', () => ({
			userId: { neq: this.editor.user.getId() },
		}))
	}

	@computed
	getContentPageBounds() {
		const viewportPageBounds = this.editor.getViewportPageBounds()
		const commonShapeBounds = this.editor.getCurrentPageBounds()
		return commonShapeBounds
			? Box.Expand(commonShapeBounds, viewportPageBounds)
			: viewportPageBounds
	}

	@computed
	getContentScreenBounds() {
		const contentPageBounds = this.getContentPageBounds()
		const topLeft = this.editor.pageToScreen(contentPageBounds.point)
		const bottomRight = this.editor.pageToScreen(
			new Vec(contentPageBounds.maxX, contentPageBounds.maxY)
		)
		return new Box(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
	}

	private getCanvasScreenBounds() {
		const { x, y, width, height } = this.elem.getBoundingClientRect()
		return new Box(x, y, width, height)
	}

	private readonly canvasBoundingClientRect = atom('canvasBoundingClientRect', new Box())

	private _listenForCanvasResize() {
		const observer = new ResizeObserver(() => {
			const rect = this.getCanvasScreenBounds()
			this.canvasBoundingClientRect.set(rect)
		})
		observer.observe(this.elem)
		return () => observer.disconnect()
	}

	@computed
	getCanvasSize() {
		const rect = this.canvasBoundingClientRect.get()
		const dpr = this.getDpr()
		return new Vec(rect.width * dpr, rect.height * dpr)
	}

	@computed
	getCanvasClientPosition() {
		return this.canvasBoundingClientRect.get().point
	}

	originPagePoint = new Vec()
	originPageCenter = new Vec()

	isInViewport = false

	/** Get the canvas's true bounds converted to page bounds. */
	@computed getCanvasPageBounds() {
		const canvasScreenBounds = this.getCanvasScreenBounds()
		const contentPageBounds = this.getContentPageBounds()

		const aspectRatio = canvasScreenBounds.width / canvasScreenBounds.height

		let targetWidth = contentPageBounds.width
		let targetHeight = targetWidth / aspectRatio
		if (targetHeight < contentPageBounds.height) {
			targetHeight = contentPageBounds.height
			targetWidth = targetHeight * aspectRatio
		}

		const box = new Box(0, 0, targetWidth, targetHeight)
		box.center = contentPageBounds.center
		return box
	}

	@computed getCanvasPageBoundsArray() {
		const { x, y, w, h } = this.getCanvasPageBounds()
		return new Float32Array([x, y, w, h])
	}

	getPagePoint = (clientX: number, clientY: number) => {
		const canvasPageBounds = this.getCanvasPageBounds()
		const canvasScreenBounds = this.getCanvasScreenBounds()

		// first offset the canvas position
		let x = clientX - canvasScreenBounds.x
		let y = clientY - canvasScreenBounds.y

		// then multiply by the ratio between the page and screen bounds
		x *= canvasPageBounds.width / canvasScreenBounds.width
		y *= canvasPageBounds.height / canvasScreenBounds.height

		// then add the canvas page bounds' offset
		x += canvasPageBounds.minX
		y += canvasPageBounds.minY

		return new Vec(x, y, 1)
	}

	minimapScreenPointToPagePoint = (
		x: number,
		y: number,
		shiftKey = false,
		clampToBounds = false
	) => {
		const { editor } = this
		const viewportPageBounds = editor.getViewportPageBounds()

		let { x: px, y: py } = this.getPagePoint(x, y)

		if (clampToBounds) {
			const shapesPageBounds = this.editor.getCurrentPageBounds()
			const vpPageBounds = viewportPageBounds

			const minX = (shapesPageBounds?.minX ?? 0) - vpPageBounds.width / 2
			const maxX = (shapesPageBounds?.maxX ?? 0) + vpPageBounds.width / 2
			const minY = (shapesPageBounds?.minY ?? 0) - vpPageBounds.height / 2
			const maxY = (shapesPageBounds?.maxY ?? 0) + vpPageBounds.height / 2

			const lx = Math.max(0, minX + vpPageBounds.width - px)
			const rx = Math.max(0, -(maxX - vpPageBounds.width - px))
			const ly = Math.max(0, minY + vpPageBounds.height - py)
			const ry = Math.max(0, -(maxY - vpPageBounds.height - py))

			const ql = Math.max(0, lx - rx)
			const qr = Math.max(0, rx - lx)
			const qt = Math.max(0, ly - ry)
			const qb = Math.max(0, ry - ly)

			if (ql && ql > qr) {
				px += ql / 2
			} else if (qr) {
				px -= qr / 2
			}

			if (qt && qt > qb) {
				py += qt / 2
			} else if (qb) {
				py -= qb / 2
			}

			px = clamp(px, minX, maxX)
			py = clamp(py, minY, maxY)
		}

		if (shiftKey) {
			const { originPagePoint } = this
			const dx = Math.abs(px - originPagePoint.x)
			const dy = Math.abs(py - originPagePoint.y)
			if (dx > dy) {
				py = originPagePoint.y
			} else {
				px = originPagePoint.x
			}
		}

		return new Vec(px, py)
	}

	render = () => {
		stats.start('minimap render')
		// make sure we update when dark mode switches
		const context = this.gl.context
		const canvasSize = this.getCanvasSize()

		this.gl.setCanvasPageBounds(this.getCanvasPageBoundsArray())

		this.elem.width = canvasSize.x
		this.elem.height = canvasSize.y
		context.viewport(0, 0, canvasSize.x, canvasSize.y)

		// this affects which color transparent shapes are blended with
		// during rendering. If we were to invert this any shapes narrower
		// than 1 px in screen space would have much lower contrast. e.g.
		// draw shapes on a large canvas.
		if (this.editor.user.getIsDarkMode()) {
			context.clearColor(1, 1, 1, 0)
		} else {
			context.clearColor(0, 0, 0, 0)
		}

		context.clear(context.COLOR_BUFFER_BIT)

		const selectedShapes = new Set(this.editor.getSelectedShapeIds())

		const colors = this.colors
		let selectedShapeOffset = 0
		let unselectedShapeOffset = 0

		const ids = this.editor.getCurrentPageShapeIdsSorted()

		for (const shapeId of ids) {
			const geometry = this.geometryCache.get(shapeId)
			if (!geometry) continue

			const len = geometry.length

			if (selectedShapes.has(shapeId)) {
				appendVertices(this.gl.selectedShapes, selectedShapeOffset, geometry)
				selectedShapeOffset += len
			} else {
				appendVertices(this.gl.unselectedShapes, unselectedShapeOffset, geometry)
				unselectedShapeOffset += len
			}
		}

		this.drawViewport()
		this.drawShapes(this.gl.unselectedShapes, unselectedShapeOffset, colors.shapeFill)
		this.drawShapes(this.gl.selectedShapes, selectedShapeOffset, colors.selectFill)
		this.drawCollaborators()
		stats.end('minimap render')
		stats.tick()
	}

	private drawShapes(stuff: BufferStuff, len: number, color: Float32Array) {
		this.gl.prepareTriangles(stuff, len)
		this.gl.setFillColor(color)
		this.gl.drawTriangles(len)
	}

	private drawViewport() {
		const viewport = this.editor.getViewportPageBounds()
		const zoom = this.getCanvasPageBounds().width / this.getCanvasScreenBounds().width
		const len = roundedRectangle(this.gl.viewport.vertices, viewport, 4 * zoom)

		this.gl.prepareTriangles(this.gl.viewport, len)
		this.gl.setFillColor(this.colors.viewportFill)
		this.gl.drawTriangles(len)
	}

	@computed
	private getCollaborators() {
		// returns one instance record per collaborator on the same page as this one
		const currentPageId = this.editor.getCurrentPageId()
		const allPresenceRecords = this.getCollaboratorsQuery().get()
		if (!allPresenceRecords.length) return EMPTY_ARRAY
		const userIds = [...new Set(allPresenceRecords.map((c) => c.userId))].sort()
		return userIds
			.map((id) => {
				const latestPresence = allPresenceRecords
					.filter((c) => c.userId === id)
					.sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp)[0]
				return latestPresence
			})
			.filter((c) => c.currentPageId === currentPageId)
	}

	drawCollaborators() {
		const collaborators = this.getCollaborators()
		if (!collaborators.length) return

		const zoom = this.getCanvasPageBounds().width / this.getCanvasScreenBounds().width

		// just draw a little circle for each collaborator
		const numSegmentsPerCircle = 20
		const dataSizePerCircle = numSegmentsPerCircle * 6
		const totalSize = dataSizePerCircle * collaborators.length

		// expand vertex array if needed
		if (this.gl.collaborators.vertices.length < totalSize) {
			this.gl.collaborators.vertices = new Float32Array(totalSize)
		}

		const vertices = this.gl.collaborators.vertices
		let offset = 0
		for (const { cursor } of collaborators) {
			pie(vertices, {
				center: Vec.From(cursor),
				radius: 2 * zoom,
				offset,
				numArcSegments: numSegmentsPerCircle,
			})
			offset += dataSizePerCircle
		}

		this.gl.prepareTriangles(this.gl.collaborators, totalSize)

		offset = 0
		for (const { color } of collaborators) {
			this.gl.setFillColor(getRgba(color))
			this.gl.context.drawArrays(this.gl.context.TRIANGLES, offset / 2, dataSizePerCircle / 2)
			offset += dataSizePerCircle
		}
	}
}

class Stats {
	periods = 0
	totals = {} as Record<string, number>
	starts = {} as Record<string, number>
	start(name: string) {
		this.starts[name] = performance.now()
	}
	end(name: string) {
		if (!this.starts[name]) throw new Error(`No start for ${name}`)
		this.totals[name] = (this.totals[name] ?? 0) + (performance.now() - this.starts[name])
		delete this.starts[name]
	}
	tick() {
		this.periods++
		if (this.periods === 60) {
			console.log('Stats:')
			for (const [name, total] of Object.entries(this.totals).sort((a, b) =>
				a[0].localeCompare(b[0])
			)) {
				console.log(' ', name, total / this.periods)
			}
			this.totals = {}
			this.starts = {}
			this.periods = 0
		}
	}
}
const stats = new Stats()
