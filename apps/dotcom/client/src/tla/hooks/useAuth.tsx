import { useValue } from 'tldraw'
import { useApp } from './useAppState'

export function useAuth() {
	const app = useApp()
	return useValue(
		'auth',
		() => {
			return app.getSessionState().auth
		},
		[app]
	)
}
