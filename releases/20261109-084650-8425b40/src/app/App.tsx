import Router from '../router/router'
import { SessionProvider } from '../schemas/session/sessionState'

export default function App() {
  return (
    <SessionProvider>
      <Router />
    </SessionProvider>
  )
}
