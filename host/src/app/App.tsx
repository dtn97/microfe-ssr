import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { routes } from './routes'

/** Props the host renders every page with. */
export interface PageProps {
  renderedAt: string
}

export interface AppProps {
  initialPath: string
  pageProps: PageProps
  versions: string[]
}

function Header() {
  return (
    <header>
      <span className="brand">MicroFE POC</span>
      <nav>
        {routes.map(({ link, label }) => (
          <Link key={link} to={link}>
            {label}
          </Link>
        ))}
      </nav>
      <span className="badge">header rendered by host</span>
    </header>
  )
}

function Footer({ versions }: { versions: string[] }) {
  return (
    <footer>
      Footer rendered by host · hybrid rendering demo · serving {versions.join(' · ')}
    </footer>
  )
}

/**
 * The host's page shell: header + routed micro app content + footer.
 * `pageProps` are the props the server rendered the initial page with; pages
 * reached by client-side navigation get placeholder props instead.
 */
export default function App({ initialPath, pageProps, versions }: AppProps) {
  const { pathname } = useLocation()
  const props: PageProps =
    pathname === initialPath
      ? pageProps
      : { renderedAt: 'never — navigated client-side (pure CSR)' }

  return (
    <>
      <Header />
      <main>
        <Routes>
          {routes.map(({ link, component: Page }) => (
            <Route key={link} path={link} element={<Page {...props} />} />
          ))}
        </Routes>
      </main>
      <Footer versions={versions} />
    </>
  )
}
