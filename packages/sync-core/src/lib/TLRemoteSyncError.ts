/** @public */
export class TLRemoteSyncError extends Error {
	override name = 'RemoteSyncError'
	constructor(public readonly reason: string) {
		super(`sync error: ${reason}`)
	}
}
