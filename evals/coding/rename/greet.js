import { getUserName } from './user.js'

export function greet(user) {
  return `Hello, ${getUserName(user)}!`
}
