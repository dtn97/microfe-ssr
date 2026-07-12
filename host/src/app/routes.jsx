import { getMicroAppComponent } from './runtime.js'

const PageAComponent = getMicroAppComponent('app-a')
const PageBComponent = getMicroAppComponent('app-b')

export const routes = [
  { link: '/', label: 'Home (A)', app: 'app-a', component: PageAComponent },
  { link: '/b', label: 'Page B', app: 'app-b', component: PageBComponent },
]
