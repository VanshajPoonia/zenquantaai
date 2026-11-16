import { slugify } from './slug.js'
if (slugify('Hello Big World') !== 'hello-big-world') throw new Error('slugify failed')
