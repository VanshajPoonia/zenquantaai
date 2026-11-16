export function sumRange(start, end) {
  let total = 0
  for (let n = start; n < end; n++) {
    total += n
  }
  return total
}
