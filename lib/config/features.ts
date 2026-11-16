/** Set NEXT_PUBLIC_ZQ_RELEASED=true once `zenquanta` is on npm, so the app only points people at zq when it installs. */
export const ZQ_RELEASED = process.env.NEXT_PUBLIC_ZQ_RELEASED === 'true'
