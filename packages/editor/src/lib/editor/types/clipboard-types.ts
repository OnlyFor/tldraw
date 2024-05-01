import { SerializedSchema } from '@tldraw/store'
import { TLAsset, TLBinding, TLShape, TLShapeId } from '@tldraw/tlschema'

/** @public */
export interface TLContent {
	shapes: TLShape[]
	bindings?: TLBinding[]
	additionalShapesForBindings?: TLShape[]
	rootShapeIds: TLShapeId[]
	assets: TLAsset[]
	schema: SerializedSchema
}
