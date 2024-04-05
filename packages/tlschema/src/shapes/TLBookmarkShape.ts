import { T } from '@tldraw/validate'
import { assetIdValidator } from '../assets/TLBaseAsset'
import {
	RETIRED_DOWN_MIGRATION,
	createShapePropsMigrationIds,
	createShapePropsMigrations,
} from '../records/TLShape'
import { ShapePropsType, TLBaseShape } from './TLBaseShape'

/** @public */
export const bookmarkShapeProps = {
	w: T.nonZeroNumber,
	h: T.nonZeroNumber,
	assetId: assetIdValidator.nullable(),
	url: T.linkUrl,
}

/** @public */
export type TLBookmarkShapeProps = ShapePropsType<typeof bookmarkShapeProps>

/** @public */
export type TLBookmarkShape = TLBaseShape<'bookmark', TLBookmarkShapeProps>

const Versions = createShapePropsMigrationIds('bookmark', {
	NullAssetId: 1,
	MakeUrlsValid: 2,
})

export { Versions as bookmarkShapeVersions }

/** @internal */
export const bookmarkShapeMigrations = createShapePropsMigrations({
	sequence: [
		{
			id: Versions.NullAssetId,
			up: (props) => {
				if (props.assetId === undefined) {
					props.assetId = null
				}
			},
			down: RETIRED_DOWN_MIGRATION,
		},
		{
			id: Versions.MakeUrlsValid,
			up: (props) => {
				if (!T.linkUrl.isValid(props.url)) {
					props.url = ''
				}
			},
			down: (_props) => {
				// noop
			},
		},
	],
})
