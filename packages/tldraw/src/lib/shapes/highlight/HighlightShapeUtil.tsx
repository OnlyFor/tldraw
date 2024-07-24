/* eslint-disable react-hooks/rules-of-hooks */
import {
	Circle2d,
	Editor,
	Polygon2d,
	SVGContainer,
	ShapeUtil,
	TLDrawShapeSegment,
	TLHighlightShape,
	TLResizeInfo,
	VecLike,
	highlightShapeMigrations,
	highlightShapeProps,
	last,
	rng,
	useValue,
} from '@tldraw/editor'
import { getHighlightFreehandSettings, getPointsFromSegments } from '../draw/getPath'
import { FONT_SIZES } from '../shared/default-shape-constants'
import { getStrokeOutlinePoints } from '../shared/freehand/getStrokeOutlinePoints'
import { getStrokePoints } from '../shared/freehand/getStrokePoints'
import { setStrokePointRadii } from '../shared/freehand/setStrokePointRadii'
import { getSvgPathFromStrokePoints } from '../shared/freehand/svg'
import { useColorSpace } from '../shared/useColorSpace'
import { useDefaultColorTheme } from '../shared/useDefaultColorTheme'

const OVERLAY_OPACITY = 0.35
const UNDERLAY_OPACITY = 0.82

/** @public */
export class HighlightShapeUtil extends ShapeUtil<TLHighlightShape> {
	static override type = 'highlight' as const
	static override props = highlightShapeProps
	static override migrations = highlightShapeMigrations

	override hideResizeHandles(shape: TLHighlightShape) {
		return getIsDot(shape)
	}
	override hideRotateHandle(shape: TLHighlightShape) {
		return getIsDot(shape)
	}
	override hideSelectionBoundsFg(shape: TLHighlightShape) {
		return getIsDot(shape)
	}

	override getDefaultProps(): TLHighlightShape['props'] {
		return {
			segments: [],
			color: 'black',
			size: 'm',
			isComplete: false,
			isPen: false,
			scale: 1,
		}
	}

	getGeometry(shape: TLHighlightShape) {
		const strokeWidth = getStrokeWidth(shape)
		if (getIsDot(shape)) {
			return new Circle2d({
				x: -strokeWidth / 2,
				y: -strokeWidth / 2,
				radius: strokeWidth / 2,
				isFilled: true,
			})
		}

		const { strokePoints, sw } = getHighlightStrokePoints(shape, strokeWidth, true)
		const opts = getHighlightFreehandSettings({ strokeWidth: sw, showAsComplete: true })
		setStrokePointRadii(strokePoints, opts)

		return new Polygon2d({
			points: getStrokeOutlinePoints(strokePoints, opts),
			isFilled: true,
		})
	}

	component(shape: TLHighlightShape) {
		const forceSolid = useHighlightForceSolid(this.editor, shape)
		const strokeWidth = getStrokeWidth(shape)

		return (
			<SVGContainer id={shape.id}>
				<HighlightRenderer
					shape={shape}
					forceSolid={forceSolid}
					strokeWidth={strokeWidth}
					opacity={OVERLAY_OPACITY}
				/>
			</SVGContainer>
		)
	}

	override backgroundComponent(shape: TLHighlightShape) {
		const forceSolid = useHighlightForceSolid(this.editor, shape)
		const strokeWidth = getStrokeWidth(shape)
		return (
			<SVGContainer id={shape.id}>
				<HighlightRenderer
					shape={shape}
					forceSolid={forceSolid}
					strokeWidth={strokeWidth}
					opacity={UNDERLAY_OPACITY}
				/>
			</SVGContainer>
		)
	}

	indicator(shape: TLHighlightShape) {
		const forceSolid = useHighlightForceSolid(this.editor, shape)
		const strokeWidth = getStrokeWidth(shape)

		const { strokePoints, sw } = getHighlightStrokePoints(shape, strokeWidth, forceSolid)
		const allPointsFromSegments = getPointsFromSegments(shape.props.segments)

		let strokePath
		if (strokePoints.length < 2) {
			strokePath = getIndicatorDot(allPointsFromSegments[0], sw)
		} else {
			strokePath = getSvgPathFromStrokePoints(strokePoints, false)
		}

		return <path d={strokePath} />
	}

	override toSvg(shape: TLHighlightShape) {
		const strokeWidth = getStrokeWidth(shape)
		const forceSolid = strokeWidth < 1.5
		const scaleFactor = 1 / shape.props.scale
		return (
			<g transform={`scale(${scaleFactor})`}>
				<HighlightRenderer
					forceSolid={forceSolid}
					strokeWidth={strokeWidth}
					shape={shape}
					opacity={OVERLAY_OPACITY}
				/>
			</g>
		)
	}

	override toBackgroundSvg(shape: TLHighlightShape) {
		const strokeWidth = getStrokeWidth(shape)
		const forceSolid = strokeWidth < 1.5
		const scaleFactor = 1 / shape.props.scale
		return (
			<g transform={`scale(${scaleFactor})`}>
				<HighlightRenderer
					forceSolid={forceSolid}
					strokeWidth={strokeWidth}
					shape={shape}
					opacity={UNDERLAY_OPACITY}
				/>
			</g>
		)
	}

	override onResize(shape: TLHighlightShape, info: TLResizeInfo<TLHighlightShape>) {
		const { scaleX, scaleY } = info

		const newSegments: TLDrawShapeSegment[] = []

		for (const segment of shape.props.segments) {
			newSegments.push({
				...segment,
				points: segment.points.map(({ x, y, z }) => {
					return {
						x: scaleX * x,
						y: scaleY * y,
						z,
					}
				}),
			})
		}

		return {
			props: {
				segments: newSegments,
			},
		}
	}
}

function getShapeDot(point: VecLike) {
	const r = 0.1
	return `M ${point.x} ${point.y} m -${r}, 0 a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${
		r * 2
	},0`
}

function getIndicatorDot(point: VecLike, sw: number) {
	const r = sw / 2
	return `M ${point.x} ${point.y} m -${r}, 0 a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${
		r * 2
	},0`
}

function getHighlightStrokePoints(
	shape: TLHighlightShape,
	strokeWidth: number,
	forceSolid: boolean
) {
	const allPointsFromSegments = getPointsFromSegments(shape.props.segments)
	const showAsComplete = shape.props.isComplete || last(shape.props.segments)?.type === 'straight'

	let sw = strokeWidth
	if (!forceSolid && !shape.props.isPen && allPointsFromSegments.length === 1) {
		sw += rng(shape.id)() * (strokeWidth / 6)
	}

	const options = getHighlightFreehandSettings({
		strokeWidth: sw,
		showAsComplete,
	})

	const strokePoints = getStrokePoints(allPointsFromSegments, options)

	return { strokePoints, sw }
}

function getStrokeWidth(shape: TLHighlightShape) {
	return FONT_SIZES[shape.props.size] * 1.12 * shape.props.scale
}

function getIsDot(shape: TLHighlightShape) {
	return shape.props.segments.length === 1 && shape.props.segments[0].points.length < 2
}

function HighlightRenderer({
	strokeWidth,
	forceSolid,
	shape,
	opacity,
}: {
	strokeWidth: number
	forceSolid: boolean
	shape: TLHighlightShape
	opacity: number
}) {
	const theme = useDefaultColorTheme()

	const allPointsFromSegments = getPointsFromSegments(shape.props.segments)

	let sw = strokeWidth
	if (!forceSolid && !shape.props.isPen && allPointsFromSegments.length === 1) {
		sw += rng(shape.id)() * (sw / 6)
	}

	const options = getHighlightFreehandSettings({
		strokeWidth: sw,
		showAsComplete: shape.props.isComplete || last(shape.props.segments)?.type === 'straight',
	})

	const strokePoints = getStrokePoints(allPointsFromSegments, options)

	const solidStrokePath =
		strokePoints.length > 1
			? getSvgPathFromStrokePoints(strokePoints, false)
			: getShapeDot(shape.props.segments[0].points[0])

	const colorSpace = useColorSpace()
	const color = theme[shape.props.color].highlight[colorSpace]

	return (
		<path
			d={solidStrokePath}
			strokeLinecap="round"
			fill="none"
			pointerEvents="all"
			stroke={color}
			strokeWidth={sw}
			opacity={opacity}
		/>
	)
}

function useHighlightForceSolid(editor: Editor, shape: TLHighlightShape) {
	return useValue(
		'forceSolid',
		() => {
			const sw = getStrokeWidth(shape)
			const zoomLevel = editor.getZoomLevel()
			if (sw / zoomLevel < 1.5) {
				return true
			}
			return false
		},
		[editor]
	)
}
