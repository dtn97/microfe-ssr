import type { MicroAppComponent } from './runtime'
import { getMicroAppComponent } from './runtime'

export interface RouteDef {
  link: string
  label: string
  moduleId: string
  component: MicroAppComponent
}

// Module ids are <app>/<module>: a micro app can expose several entry
// modules (app-b exposes b1 and b2), built together with shared chunks.
const HomePage = getMicroAppComponent('app-a/main')
const PageB1 = getMicroAppComponent('app-b/b1')
const PageB2 = getMicroAppComponent('app-b/b2')

export const routes: RouteDef[] = [
  { link: '/', label: 'Home (A)', moduleId: 'app-a/main', component: HomePage },
  { link: '/b1', label: 'Page B1', moduleId: 'app-b/b1', component: PageB1 },
  { link: '/b2', label: 'Page B2', moduleId: 'app-b/b2', component: PageB2 },
]
